use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_FREE_CONNECTIONS: usize = 2;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserState {
    pub is_pro: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStatus {
    pub is_pro: bool,
    pub max_connections: usize,
}

pub struct UserStateManager {
    state: RwLock<UserState>,
}

impl UserStateManager {
    pub fn new() -> Self {
        Self {
            state: RwLock::new(UserState::default()),
        }
    }

    pub async fn set_pro_status(&self, is_pro: bool) {
        let mut state = self.state.write().await;
        state.is_pro = is_pro;
    }

    pub async fn is_pro(&self) -> bool {
        let state = self.state.read().await;
        state.is_pro
    }

    pub async fn get_max_connections(&self) -> usize {
        let state = self.state.read().await;
        if state.is_pro {
            usize::MAX
        } else {
            MAX_FREE_CONNECTIONS
        }
    }

    pub async fn get_status(&self) -> UserStatus {
        let state = self.state.read().await;
        UserStatus {
            is_pro: state.is_pro,
            max_connections: if state.is_pro {
                usize::MAX
            } else {
                MAX_FREE_CONNECTIONS
            },
        }
    }
}

impl Default for UserStateManager {
    fn default() -> Self {
        Self::new()
    }
}

pub type UserState_ = Arc<UserStateManager>;

pub fn create_user_state_manager() -> UserStateManager {
    UserStateManager::new()
}

// Tauri commands

#[tauri::command]
pub async fn set_user_pro_status(
    state: tauri::State<'_, UserState_>,
    is_pro: bool,
) -> Result<(), String> {
    state.set_pro_status(is_pro).await;
    Ok(())
}

#[tauri::command]
pub async fn get_user_status(state: tauri::State<'_, UserState_>) -> Result<UserStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn get_max_connections(state: tauri::State<'_, UserState_>) -> Result<usize, String> {
    Ok(state.get_max_connections().await)
}

#[tauri::command]
pub async fn is_user_pro(state: tauri::State<'_, UserState_>) -> Result<bool, String> {
    Ok(state.is_pro().await)
}
