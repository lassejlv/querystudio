use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{path::BaseDirectory, AppHandle, Manager};

const SETTINGS_FILE_NAME: &str = "settings.json";
const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub schema_version: u32,
    pub active_tab: String,
    pub ai_panel_open: bool,
    pub ai_panel_width: u32,
    pub sidebar_width: u32,
    pub sidebar_collapsed: bool,
    pub status_bar_visible: bool,
    pub auto_reconnect: bool,
    pub multi_connections_enabled: bool,
    pub experimental_terminal: bool,
    pub experimental_plugins: bool,
    pub debug_mode: bool,
    pub migrated_from_legacy: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            active_tab: "data".to_string(),
            ai_panel_open: false,
            ai_panel_width: 420,
            sidebar_width: 256,
            sidebar_collapsed: false,
            status_bar_visible: true,
            auto_reconnect: true,
            multi_connections_enabled: true,
            experimental_terminal: false,
            experimental_plugins: false,
            debug_mode: false,
            migrated_from_legacy: false,
        }
    }
}

impl AppSettings {
    fn normalize(&mut self) {
        self.schema_version = CURRENT_SCHEMA_VERSION;
        self.ai_panel_width = self.ai_panel_width.clamp(320, 800);
        self.sidebar_width = self.sidebar_width.clamp(180, 400);
        if self.active_tab.trim().is_empty() {
            self.active_tab = "data".to_string();
        }
    }
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(SETTINGS_FILE_NAME, BaseDirectory::AppConfig)
        .map_err(|error| format!("failed to resolve settings path: {error}"))
}

async fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "settings path has no parent directory".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("failed to create settings directory: {error}"))
}

async fn backup_invalid_settings(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to generate backup timestamp: {error}"))?
        .as_secs();

    let backup_name = format!("settings.invalid.{timestamp}.bak");
    let backup_path = path.with_file_name(backup_name);

    tokio::fs::rename(path, &backup_path)
        .await
        .map_err(|error| format!("failed to back up invalid settings file: {error}"))
}

pub async fn save_settings_to_path(path: &Path, settings: &AppSettings) -> Result<(), String> {
    ensure_parent_dir(path).await?;

    let mut normalized = settings.clone();
    normalized.normalize();

    let json = serde_json::to_vec_pretty(&normalized)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;

    let temp_path = path.with_extension("json.tmp");
    tokio::fs::write(&temp_path, json)
        .await
        .map_err(|error| format!("failed to write temp settings file: {error}"))?;

    if path.exists() {
        tokio::fs::remove_file(path)
            .await
            .map_err(|error| format!("failed to replace settings file: {error}"))?;
    }

    tokio::fs::rename(&temp_path, path)
        .await
        .map_err(|error| format!("failed to finalize settings file: {error}"))
}

pub async fn load_settings_from_path(path: &Path) -> Result<AppSettings, String> {
    if !path.exists() {
        let defaults = AppSettings::default();
        save_settings_to_path(path, &defaults).await?;
        return Ok(defaults);
    }

    let raw = tokio::fs::read_to_string(path)
        .await
        .map_err(|error| format!("failed to read settings file: {error}"))?;

    let mut settings = match serde_json::from_str::<AppSettings>(&raw) {
        Ok(parsed) => parsed,
        Err(_) => {
            backup_invalid_settings(path).await?;
            let defaults = AppSettings::default();
            save_settings_to_path(path, &defaults).await?;
            return Ok(defaults);
        }
    };

    let mut needs_write = false;
    if settings.schema_version != CURRENT_SCHEMA_VERSION {
        settings.schema_version = CURRENT_SCHEMA_VERSION;
        needs_write = true;
    }

    let before = settings.clone();
    settings.normalize();
    if before.active_tab != settings.active_tab
        || before.ai_panel_width != settings.ai_panel_width
        || before.sidebar_width != settings.sidebar_width
        || before.schema_version != settings.schema_version
    {
        needs_write = true;
    }

    if needs_write {
        save_settings_to_path(path, &settings).await?;
    }

    Ok(settings)
}

fn merge_patch(target: &mut Value, patch: Value) {
    match patch {
        Value::Object(patch_object) => {
            if !target.is_object() {
                *target = Value::Object(serde_json::Map::new());
            }

            if let Value::Object(target_object) = target {
                for (key, value) in patch_object {
                    if value.is_null() {
                        target_object.remove(&key);
                    } else {
                        match target_object.get_mut(&key) {
                            Some(existing) => merge_patch(existing, value),
                            None => {
                                target_object.insert(key, value);
                            }
                        }
                    }
                }
            }
        }
        other => {
            *target = other;
        }
    }
}

pub async fn load_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_file_path(app)?;
    load_settings_from_path(&path).await
}

pub async fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<AppSettings, String> {
    let path = settings_file_path(app)?;
    let mut normalized = settings.clone();
    normalized.normalize();
    save_settings_to_path(&path, &normalized).await?;
    Ok(normalized)
}

pub async fn update_settings(app: &AppHandle, patch: Value) -> Result<AppSettings, String> {
    let path = settings_file_path(app)?;
    let current = load_settings_from_path(&path).await?;

    let mut value = serde_json::to_value(current)
        .map_err(|error| format!("failed to convert settings into JSON value: {error}"))?;
    merge_patch(&mut value, patch);

    let mut updated: AppSettings = serde_json::from_value(value)
        .map_err(|error| format!("invalid settings patch payload: {error}"))?;
    updated.normalize();

    save_settings_to_path(&path, &updated).await?;
    Ok(updated)
}

pub async fn reset_settings_to_defaults(app: &AppHandle) -> Result<AppSettings, String> {
    let defaults = AppSettings::default();
    save_settings(app, &defaults).await
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    load_settings(&app).await
}

#[tauri::command]
pub async fn set_settings(app: AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    save_settings(&app, &settings).await
}

#[tauri::command]
pub async fn patch_settings(app: AppHandle, patch: Value) -> Result<AppSettings, String> {
    update_settings(&app, patch).await
}

#[tauri::command]
pub async fn reset_settings(app: AppHandle) -> Result<AppSettings, String> {
    reset_settings_to_defaults(&app).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_settings_path() -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("querystudio-test-{}", Uuid::new_v4()));
        path.push("settings.json");
        path
    }

    #[tokio::test]
    async fn creates_default_settings_when_missing() {
        let path = test_settings_path();
        let settings = load_settings_from_path(&path)
            .await
            .expect("loads defaults");
        assert_eq!(settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(settings.active_tab, "data");
        assert!(path.exists());
    }

    #[tokio::test]
    async fn recovers_from_invalid_json() {
        let path = test_settings_path();
        ensure_parent_dir(&path).await.expect("creates parent dir");
        tokio::fs::write(&path, "{ invalid json")
            .await
            .expect("writes invalid json");

        let settings = load_settings_from_path(&path)
            .await
            .expect("recovers settings");
        assert_eq!(settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(settings.auto_reconnect);
    }

    #[tokio::test]
    async fn saves_and_normalizes_settings() {
        let path = test_settings_path();
        let settings = AppSettings {
            ai_panel_width: 9999,
            sidebar_width: 1,
            ..AppSettings::default()
        };
        save_settings_to_path(&path, &settings)
            .await
            .expect("saves settings");

        let reloaded = load_settings_from_path(&path)
            .await
            .expect("reloads settings");
        assert_eq!(reloaded.ai_panel_width, 800);
        assert_eq!(reloaded.sidebar_width, 180);
    }
}
