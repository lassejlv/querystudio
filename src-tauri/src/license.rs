use parking_lot::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

const LICENSE_API_URL: &str = "https://api.querystudio.dev";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseInfo {
    pub id: String,
    pub key: String,
    pub display_key: String,
    pub status: String,
    pub customer_id: String,
    pub email: String,
    pub customer_name: Option<String>,
    pub activations_count: i32,
    pub max_activations: Option<i32>,
    pub usage: i32,
    pub max_usage: Option<i32>,
    pub validations: i32,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub benefit_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateLicenseResponse {
    pub valid: bool,
    pub license: Option<LicenseInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateLicenseResponse {
    pub success: bool,
    pub activation_id: Option<String>,
    pub license: Option<LicenseInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeactivateLicenseResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredLicense {
    pub license_key: String,
    #[serde(default)]
    pub activation_id: Option<String>,
    pub device_id: String,
    pub license_info: LicenseInfo,
    pub validated_at: String,
}

pub struct LicenseManager {
    client: Client,
    license: RwLock<Option<StoredLicense>>,
}

impl LicenseManager {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            license: RwLock::new(None),
        }
    }

    pub fn get_device_id() -> String {
        machine_uid::get().unwrap_or_else(|_| uuid::Uuid::new_v4().to_string())
    }

    pub fn is_licensed(&self) -> bool {
        self.license.read().is_some()
    }

    pub fn get_license(&self) -> Option<StoredLicense> {
        self.license.read().clone()
    }

    pub fn set_license(&self, license: StoredLicense) {
        *self.license.write() = Some(license);
    }

    pub fn clear_license(&self) {
        *self.license.write() = None;
    }

    pub async fn validate_license(&self, license_key: &str) -> Result<ValidateLicenseResponse, String> {
        let url = format!("{}/api/license/validate", LICENSE_API_URL);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "licenseKey": license_key }))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if response.status().is_success() {
            response
                .json::<ValidateLicenseResponse>()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(format!("License validation failed: {}", error_body))
        }
    }

    /// Validate and store a license locally (for licenses that don't support activations)
    pub async fn validate_and_store_license(&self, license_key: &str) -> Result<ValidateLicenseResponse, String> {
        let result = self.validate_license(license_key).await?;

        if result.valid {
            if let Some(license_info) = result.license.clone() {
                let stored = StoredLicense {
                    license_key: license_key.to_string(),
                    activation_id: None,
                    device_id: Self::get_device_id(),
                    license_info,
                    validated_at: chrono::Utc::now().to_rfc3339(),
                };
                self.set_license(stored);
            }
        }

        Ok(result)
    }

    /// Try to activate with the API, fall back to validate-only if activations not supported
    pub async fn activate_license(
        &self,
        license_key: &str,
        device_name: Option<&str>,
    ) -> Result<ActivateLicenseResponse, String> {
        let device_id = Self::get_device_id();
        let url = format!("{}/api/license/activate", LICENSE_API_URL);

        let mut body = serde_json::json!({
            "licenseKey": license_key,
            "deviceId": device_id,
        });

        if let Some(name) = device_name {
            body["deviceName"] = serde_json::Value::String(name.to_string());
        }

        let response = self
            .client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if response.status().is_success() {
            let result = response
                .json::<ActivateLicenseResponse>()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            // Store the license if activation was successful
            if result.success {
                if let Some(license_info) = result.license.clone() {
                    let stored = StoredLicense {
                        license_key: license_key.to_string(),
                        activation_id: result.activation_id.clone(),
                        device_id,
                        license_info,
                        validated_at: chrono::Utc::now().to_rfc3339(),
                    };
                    self.set_license(stored);
                }
            }

            Ok(result)
        } else {
            // Check if this is a "NotPermitted" error (activations not supported)
            let error_body = response.text().await.unwrap_or_default();
            
            if error_body.contains("NotPermitted") || error_body.contains("does not support activations") {
                // Fall back to validate-only flow
                let validate_result = self.validate_and_store_license(license_key).await?;
                
                return Ok(ActivateLicenseResponse {
                    success: validate_result.valid,
                    activation_id: None,
                    license: validate_result.license,
                    error: validate_result.error,
                });
            }
            
            Err(format!("License activation failed: {}", error_body))
        }
    }

    pub async fn deactivate_license(&self) -> Result<DeactivateLicenseResponse, String> {
        let stored = self
            .get_license()
            .ok_or_else(|| "No active license".to_string())?;

        // If there's no activation_id, this was a validate-only license
        // Just clear it locally without calling the API
        if stored.activation_id.is_none() {
            self.clear_license();
            return Ok(DeactivateLicenseResponse {
                success: true,
                error: None,
            });
        }

        let url = format!("{}/api/license/deactivate", LICENSE_API_URL);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "licenseKey": stored.license_key,
                "activationId": stored.activation_id,
            }))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to license server: {}", e))?;

        if response.status().is_success() {
            let result = response
                .json::<DeactivateLicenseResponse>()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            if result.success {
                self.clear_license();
            }

            Ok(result)
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(format!("License deactivation failed: {}", error_body))
        }
    }

    pub async fn revalidate_license(&self) -> Result<bool, String> {
        let stored = match self.get_license() {
            Some(s) => s,
            None => return Ok(false),
        };

        let result = self.validate_license(&stored.license_key).await?;

        if !result.valid {
            self.clear_license();
            return Ok(false);
        }

        // Update license info
        if let Some(license_info) = result.license {
            let updated = StoredLicense {
                license_info,
                validated_at: chrono::Utc::now().to_rfc3339(),
                ..stored
            };
            self.set_license(updated);
        }

        Ok(true)
    }
}

pub type LicenseState = Arc<LicenseManager>;
