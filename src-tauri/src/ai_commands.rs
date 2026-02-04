use log::{debug, error, info};
use querystudio_ai::providers;
use querystudio_ai::{AIModel, AIProviderError, Agent, AgentMessage, ModelInfo};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::database::ConnectionManager;
use querystudio_ai::DatabaseType;

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub connection_id: String,
    pub session_id: String,
    pub message: String,
    pub model: String,
    pub api_key: String,
    pub db_type: DatabaseType,
    #[serde(default)]
    pub history: Vec<AgentMessage>,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub session_id: String,
}

#[tauri::command]
pub fn ai_get_models() -> Vec<ModelInfo> {
    providers::get_available_models()
}

#[tauri::command]
pub async fn ai_validate_key(api_key: String, model: String) -> Result<bool, String> {
    let model: AIModel = model.parse().map_err(|e: AIProviderError| e.to_string())?;
    let provider =
        providers::create_ai_provider(model.provider(), api_key).map_err(|e| e.to_string())?;

    let messages = vec![querystudio_ai::ChatMessage::user("Hi")];
    match provider.chat(&model, messages, &[]).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn ai_chat_stream(
    app_handle: AppHandle,
    db_state: State<'_, Arc<ConnectionManager>>,
    request: ChatRequest,
) -> Result<(), String> {
    info!(
        "AI stream [session={}] model={} conn={} db={:?}",
        request.session_id, request.model, request.connection_id, request.db_type
    );

    let model: AIModel = request.model.parse().map_err(|e: AIProviderError| {
        error!("AI model parse failed: {}", e);
        e.to_string()
    })?;

    let mut agent = Agent::new(
        request.api_key.clone(),
        db_state.inner().clone(),
        request.connection_id.clone(),
        request.db_type,
        model,
    )
    .map_err(|e| {
        error!("AI agent creation failed: {}", e);
        e.to_string()
    })?;

    if !request.history.is_empty() {
        debug!("AI loading {} history messages", request.history.len());
        agent.load_messages(request.history);
    }

    debug!(
        "AI chat_stream starting: {}",
        request.message.chars().take(100).collect::<String>()
    );

    let mut rx = agent.chat_stream(request.message).await.map_err(|e| {
        error!("AI chat_stream failed: {}", e);
        e.to_string()
    })?;

    let event_name = format!("ai-stream-{}", request.session_id);
    let session_id = request.session_id.clone();

    tokio::spawn(async move {
        let mut event_count = 0;
        while let Some(event) = rx.recv().await {
            event_count += 1;
            if let Err(e) = app_handle.emit(&event_name, &event) {
                error!("AI emit failed [session={}]: {}", session_id, e);
            }
        }
        info!(
            "AI stream done [session={}]: {} events",
            session_id, event_count
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn ai_chat(
    db_state: State<'_, Arc<ConnectionManager>>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let model: AIModel = request
        .model
        .parse()
        .map_err(|e: AIProviderError| e.to_string())?;

    let mut agent = Agent::new(
        request.api_key,
        db_state.inner().clone(),
        request.connection_id.clone(),
        request.db_type,
        model,
    )
    .map_err(|e| e.to_string())?;

    if !request.history.is_empty() {
        agent.load_messages(request.history);
    }

    let content = agent
        .chat(request.message)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ChatResponse {
        content,
        session_id: request.session_id,
    })
}

#[tauri::command]
pub async fn ai_fetch_openrouter_models(api_key: String) -> Result<Vec<ModelInfo>, String> {
    providers::openrouter::fetch_models(&api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_fetch_vercel_models(api_key: String) -> Result<Vec<ModelInfo>, String> {
    providers::vercel::fetch_models(&api_key)
        .await
        .map_err(|e| e.to_string())
}
