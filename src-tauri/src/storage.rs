use crate::providers::DatabaseType;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub db_type: DatabaseType,
    pub config: SavedConnectionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SavedConnectionConfig {
    ConnectionString {
        connection_string: String,
    },
    Parameters {
        host: String,
        port: u16,
        database: String,
        username: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SavedConnections {
    pub connections: Vec<SavedConnection>,
}

fn get_storage_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("connections.json"))
}

pub fn load_connections(app_handle: &tauri::AppHandle) -> Result<SavedConnections, String> {
    let path = get_storage_path(app_handle)?;

    if !path.exists() {
        return Ok(SavedConnections::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_connections(
    app_handle: &tauri::AppHandle,
    connections: &SavedConnections,
) -> Result<(), String> {
    let path = get_storage_path(app_handle)?;
    let content = serde_json::to_string_pretty(connections).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn add_connection(
    app_handle: &tauri::AppHandle,
    connection: SavedConnection,
) -> Result<(), String> {
    let mut saved = load_connections(app_handle)?;
    saved.connections.retain(|c| c.id != connection.id);
    saved.connections.push(connection);
    save_connections(app_handle, &saved)
}

pub fn remove_connection(app_handle: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut saved = load_connections(app_handle)?;
    saved.connections.retain(|c| c.id != id);
    save_connections(app_handle, &saved)
}
