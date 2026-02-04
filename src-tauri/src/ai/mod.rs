pub mod agent;
pub mod providers;
pub mod tools;

use agent::Agent;
use providers::get_available_models;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::database::ConnectionManager;
use crate::providers::DatabaseType;

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
    get_available_models()
}

#[tauri::command]
pub async fn ai_validate_key(api_key: String, model: String) -> Result<bool, String> {
    let model: AIModel = model
        .parse()
        .map_err(|e: providers::AIProviderError| e.to_string())?;
    let provider =
        providers::create_ai_provider(model.provider(), api_key).map_err(|e| e.to_string())?;

    let messages = vec![providers::ChatMessage::user("Hi")];
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
    println!(
        "[AI] ai_chat_stream called with session_id: {}",
        request.session_id
    );
    println!(
        "[AI] model: {}, connection_id: {}, db_type: {:?}",
        request.model, request.connection_id, request.db_type
    );

    let model: AIModel = request
        .model
        .parse()
        .map_err(|e: providers::AIProviderError| {
            println!("[AI] Failed to parse model: {}", e);
            e.to_string()
        })?;

    println!("[AI] Creating agent...");

    let mut agent = Agent::new(
        request.api_key.clone(),
        db_state.inner().clone(),
        request.connection_id.clone(),
        request.db_type,
        model,
    )
    .map_err(|e| {
        println!("[AI] Failed to create agent: {}", e);
        e.to_string()
    })?;

    println!("[AI] Agent created successfully");

    if !request.history.is_empty() {
        println!("[AI] Loading {} history messages", request.history.len());
        agent.load_messages(request.history);
    }

    println!(
        "[AI] Starting chat_stream with message: {}",
        request.message
    );

    let mut rx = agent.chat_stream(request.message).await.map_err(|e| {
        println!("[AI] chat_stream failed: {}", e);
        e.to_string()
    })?;

    println!("[AI] chat_stream started, receiver obtained");

    let event_name = format!("ai-stream-{}", request.session_id);
    println!("[AI] Will emit events to: {}", event_name);

    tokio::spawn(async move {
        let mut event_count = 0;
        while let Some(event) = rx.recv().await {
            event_count += 1;
            println!("[AI] Emitting event #{}: {:?}", event_count, event);
            let result = app_handle.emit(&event_name, &event);
            if let Err(e) = result {
                println!("[AI] Failed to emit event: {}", e);
            }
        }
        println!("[AI] Stream ended after {} events", event_count);
    });

    println!("[AI] ai_chat_stream returning Ok(())");
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
        .map_err(|e: providers::AIProviderError| e.to_string())?;

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

pub use agent::AgentMessage;
pub use providers::{AIModel, ModelInfo};
