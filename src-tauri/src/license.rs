use machine_uid;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

const LICENSE_API_BASE: &str = "https://querystudio.dev/api/license";
const MAX_FREE_CONNECTIONS: usize = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OsType {
    Ios,
    Android,
    Macos,
    Windows,
    Linux,
}

impl Default for OsType {
    fn default() -> Self {
        #[cfg(target_os = "macos")]
        return OsType::Macos;
        #[cfg(target_os = "windows")]
        return OsType::Windows;
        #[cfg(target_os = "linux")]
        return OsType::Linux;
        #[cfg(target_os = "ios")]
        return OsType::Ios;
        #[cfg(target_os = "android")]
        return OsType::Android;
        #[cfg(not(any(
            target_os = "macos",
            target_os = "windows",
            target_os = "linux",
            target_os = "ios",
            target_os = "android"
        )))]
        return OsType::Linux;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LicenseState {
    pub license_key: Option<String>,
    pub device_token: Option<String>,
    pub device_name: Option<String>,
    pub is_activated: bool,
    pub is_pro: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub active: bool,
    #[serde(rename = "osType")]
    pub os_type: Option<String>,
    #[serde(rename = "lastSeenAt")]
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateRequest {
    #[serde(rename = "licenseKey")]
    pub license_key: String,
    #[serde(rename = "deviceName")]
    pub device_name: String,
    #[serde(rename = "osType")]
    pub os_type: Option<OsType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateDeviceInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "deviceToken")]
    pub device_token: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateResponse {
    pub success: bool,
    pub device: Option<ActivateDeviceInfo>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyRequest {
    #[serde(rename = "deviceToken")]
    pub device_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResponse {
    pub valid: bool,
    pub active: bool,
    #[serde(rename = "isPro")]
    pub is_pro: Option<bool>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRequest {
    #[serde(rename = "licenseKey")]
    pub license_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResponse {
    pub valid: bool,
    #[serde(rename = "isPro")]
    pub is_pro: Option<bool>,
    #[serde(rename = "activeDevices")]
    pub active_devices: Option<i32>,
    #[serde(rename = "maxDevices")]
    pub max_devices: Option<i32>,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeactivateRequest {
    #[serde(rename = "deviceToken")]
    pub device_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeactivateResponse {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevicesResponse {
    pub devices: Vec<DeviceInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatus {
    pub is_activated: bool,
    pub is_pro: bool,
    pub max_connections: usize,
    pub device_name: Option<String>,
}

pub struct LicenseManager {
    client: Client,
    state: parking_lot::RwLock<LicenseState>,
    storage_path: Option<PathBuf>,
}

impl LicenseManager {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            state: parking_lot::RwLock::new(LicenseState::default()),
            storage_path: None,
        }
    }

    pub fn with_storage_path(mut self, path: PathBuf) -> Self {
        self.storage_path = Some(path);
        // Try to load existing state
        if let Some(ref path) = self.storage_path {
            if path.exists() {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(state) = serde_json::from_str::<LicenseState>(&content) {
                        *self.state.write() = state;
                    }
                }
            }
        }
        self
    }

    fn save_state(&self) -> Result<(), String> {
        if let Some(ref path) = self.storage_path {
            let state = self.state.read();
            let content = serde_json::to_string_pretty(&*state).map_err(|e| e.to_string())?;
            fs::write(path, content).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_machine_id() -> String {
        machine_uid::get().unwrap_or_else(|_| uuid::Uuid::new_v4().to_string())
    }

    pub fn get_default_device_name() -> String {
        hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| format!("Device-{}", &Self::get_machine_id()[..8]))
    }

    pub async fn activate(
        &self,
        license_key: String,
        device_name: Option<String>,
    ) -> Result<ActivateResponse, String> {
        let device_name = device_name.unwrap_or_else(Self::get_default_device_name);

        let request = ActivateRequest {
            license_key: license_key.clone(),
            device_name: device_name.clone(),
            os_type: Some(OsType::default()),
        };

        let response = self
            .client
            .post(format!("{}/activate", LICENSE_API_BASE))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("License activation failed ({}): {}", status, body));
        }

        let result: ActivateResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse activation response: {}", e))?;

        if result.success {
            if let Some(ref device) = result.device {
                let mut state = self.state.write();
                state.license_key = Some(license_key);
                state.device_token = Some(device.device_token.clone());
                state.device_name = Some(device_name);
                state.is_activated = true;
                state.is_pro = true;
                drop(state);
                self.save_state()?;
            }
        }

        Ok(result)
    }

    pub async fn verify(&self) -> Result<VerifyResponse, String> {
        let device_token = {
            let state = self.state.read();
            state.device_token.clone()
        };

        let device_token = device_token.ok_or("No device token found. Please activate first.")?;

        let request = VerifyRequest { device_token };

        let response = self
            .client
            .post(format!("{}/verify", LICENSE_API_BASE))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            if status.as_u16() == 401 || status.as_u16() == 403 {
                // Token invalid or revoked, clear local state
                let mut state = self.state.write();
                state.is_activated = false;
                state.is_pro = false;
                drop(state);
                self.save_state()?;
            }
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Verification failed ({}): {}", status, body));
        }

        let result: VerifyResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse verification response: {}", e))?;

        // Update local state based on verification
        {
            let mut state = self.state.write();
            state.is_activated = result.valid && result.active;
            state.is_pro = result.is_pro.unwrap_or(false);
        }
        self.save_state()?;

        Ok(result)
    }

    pub async fn check_license(&self, license_key: &str) -> Result<CheckResponse, String> {
        let request = CheckRequest {
            license_key: license_key.to_string(),
        };

        let response = self
            .client
            .post(format!("{}/check", LICENSE_API_BASE))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("License check failed ({}): {}", status, body));
        }

        let result: CheckResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse check response: {}", e))?;

        Ok(result)
    }

    pub async fn deactivate(&self) -> Result<DeactivateResponse, String> {
        let device_token = {
            let state = self.state.read();
            state.device_token.clone()
        };

        let device_token = device_token.ok_or("No device token found.")?;

        let request = DeactivateRequest { device_token };

        let response = self
            .client
            .post(format!("{}/deactivate", LICENSE_API_BASE))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        let result: DeactivateResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse deactivation response: {}", e))?;

        if result.success {
            let mut state = self.state.write();
            state.device_token = None;
            state.is_activated = false;
            state.is_pro = false;
            drop(state);
            self.save_state()?;
        }

        Ok(result)
    }

    pub async fn list_devices(&self) -> Result<Vec<DeviceInfo>, String> {
        let license_key = {
            let state = self.state.read();
            state.license_key.clone()
        };

        let license_key = license_key.ok_or("No license key found.")?;

        let response = self
            .client
            .get(format!("{}/devices", LICENSE_API_BASE))
            .query(&[("licenseKey", &license_key)])
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Failed to list devices ({}): {}", status, body));
        }

        let result: DevicesResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse devices response: {}", e))?;

        Ok(result.devices)
    }

    pub fn get_status(&self) -> LicenseStatus {
        let state = self.state.read();
        LicenseStatus {
            is_activated: state.is_activated,
            is_pro: state.is_pro,
            max_connections: if state.is_pro {
                usize::MAX
            } else {
                MAX_FREE_CONNECTIONS
            },
            device_name: state.device_name.clone(),
        }
    }

    pub fn get_max_connections(&self) -> usize {
        let state = self.state.read();
        if state.is_pro && state.is_activated {
            usize::MAX
        } else {
            MAX_FREE_CONNECTIONS
        }
    }

    /// Verify license status before allowing a connection.
    /// This checks with the remote API if we have a device token,
    /// otherwise falls back to local state.
    /// Returns (is_pro, max_connections)
    pub async fn verify_for_connection(&self) -> (bool, usize) {
        let has_device_token = {
            let state = self.state.read();
            state.device_token.is_some()
        };

        // If we have a device token, verify with the server
        if has_device_token {
            match self.verify().await {
                Ok(result) => {
                    let is_pro = result.valid && result.active && result.is_pro.unwrap_or(false);
                    let max = if is_pro {
                        usize::MAX
                    } else {
                        MAX_FREE_CONNECTIONS
                    };
                    return (is_pro, max);
                }
                Err(e) => {
                    // Log the error but don't block - fall back to local state
                    eprintln!("[License] Verification failed, using local state: {}", e);
                }
            }
        }

        // Fall back to local state
        let state = self.state.read();
        let is_pro = state.is_pro && state.is_activated;
        let max = if is_pro {
            usize::MAX
        } else {
            MAX_FREE_CONNECTIONS
        };
        (is_pro, max)
    }

    pub fn is_pro(&self) -> bool {
        let state = self.state.read();
        state.is_pro && state.is_activated
    }

    pub fn get_license_key(&self) -> Option<String> {
        self.state.read().license_key.clone()
    }

    pub fn get_device_token(&self) -> Option<String> {
        self.state.read().device_token.clone()
    }

    pub fn clear(&self) -> Result<(), String> {
        let mut state = self.state.write();
        *state = LicenseState::default();
        drop(state);
        self.save_state()
    }
}

pub type LicenseState_ = Arc<LicenseManager>;

pub fn get_license_storage_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("license.json"))
}

pub fn create_license_manager(app_handle: &tauri::AppHandle) -> Result<LicenseManager, String> {
    let path = get_license_storage_path(app_handle)?;
    Ok(LicenseManager::new().with_storage_path(path))
}

// Tauri command implementations
#[tauri::command]
pub async fn license_activate(
    license_state: tauri::State<'_, LicenseState_>,
    license_key: String,
    device_name: Option<String>,
) -> Result<ActivateResponse, String> {
    license_state.activate(license_key, device_name).await
}

#[tauri::command]
pub async fn license_verify(
    license_state: tauri::State<'_, LicenseState_>,
) -> Result<VerifyResponse, String> {
    license_state.verify().await
}

#[tauri::command]
pub async fn license_check(
    license_state: tauri::State<'_, LicenseState_>,
    license_key: String,
) -> Result<CheckResponse, String> {
    license_state.check_license(&license_key).await
}

#[tauri::command]
pub async fn license_deactivate(
    license_state: tauri::State<'_, LicenseState_>,
) -> Result<DeactivateResponse, String> {
    license_state.deactivate().await
}

#[tauri::command]
pub async fn license_list_devices(
    license_state: tauri::State<'_, LicenseState_>,
) -> Result<Vec<DeviceInfo>, String> {
    license_state.list_devices().await
}

#[tauri::command]
pub fn license_get_status(license_state: tauri::State<'_, LicenseState_>) -> LicenseStatus {
    license_state.get_status()
}

#[tauri::command]
pub fn license_get_max_connections(license_state: tauri::State<'_, LicenseState_>) -> usize {
    license_state.get_max_connections()
}

#[tauri::command]
pub fn license_is_pro(license_state: tauri::State<'_, LicenseState_>) -> bool {
    license_state.is_pro()
}

#[tauri::command]
pub fn license_clear(license_state: tauri::State<'_, LicenseState_>) -> Result<(), String> {
    license_state.clear()
}

/// Refresh license status by verifying with the remote API.
/// This should be called periodically (e.g., on app startup, every hour).
/// Returns the updated license status.
#[tauri::command]
pub async fn license_refresh(
    license_state: tauri::State<'_, LicenseState_>,
) -> Result<LicenseStatus, String> {
    // If we have a device token, verify with the server
    let has_device_token = {
        let state = license_state.state.read();
        state.device_token.is_some()
    };

    if has_device_token {
        // Try to verify - this updates local state
        match license_state.verify().await {
            Ok(_) => {
                // Verification successful, return updated status
            }
            Err(e) => {
                // Log error but don't fail - local state was already updated by verify()
                eprintln!("[License] Refresh verification failed: {}", e);
            }
        }
    }

    Ok(license_state.get_status())
}
