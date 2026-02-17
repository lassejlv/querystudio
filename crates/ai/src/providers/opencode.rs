use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, ChatRole,
    FinishReason, ModelInfo, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

/// OpenCode provider that connects to a local `opencode serve` instance.
///
/// The `api_key` field holds the server base URL (e.g. "http://127.0.0.1:4096").
/// If the server uses basic auth, the URL should include credentials:
/// "http://user:pass@127.0.0.1:4096"
pub struct OpenCodeProvider {
    client: Client,
    /// Base URL of the opencode server (e.g. "http://127.0.0.1:4096")
    base_url: String,
}

impl OpenCodeProvider {
    pub fn new(base_url: String) -> Self {
        // Trim trailing slash for consistent URL joining
        let base_url = base_url.trim_end_matches('/').to_string();
        Self {
            client: Client::new(),
            base_url,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

// ============================================================================
// OpenCode API Types
// ============================================================================

#[derive(Debug, Serialize)]
struct CreateSessionRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenCodeSession {
    id: String,
}

#[derive(Debug, Serialize)]
struct MessageRequest {
    parts: Vec<TextPartInput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<ModelRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<std::collections::HashMap<String, bool>>,
}

#[derive(Debug, Serialize)]
struct ModelRef {
    #[serde(rename = "providerID")]
    provider_id: String,
    #[serde(rename = "modelID")]
    model_id: String,
}

#[derive(Debug, Serialize)]
struct TextPartInput {
    #[serde(rename = "type")]
    part_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    info: AssistantMessageInfo,
    parts: Vec<PartResponse>,
}

#[derive(Debug, Deserialize)]
struct AssistantMessageInfo {
    #[serde(default)]
    tokens: Option<TokenInfo>,
    #[serde(default)]
    error: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TokenInfo {
    #[serde(default)]
    input: u64,
    #[serde(default)]
    output: u64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum PartResponse {
    #[serde(rename = "text")]
    Text {
        text: String,
        #[serde(default)]
        synthetic: Option<bool>,
    },
    #[serde(rename = "tool")]
    Tool {
        #[serde(rename = "callID")]
        call_id: String,
        tool: String,
        state: ToolStateResponse,
    },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ToolStateResponse {
    status: String,
    #[serde(default)]
    input: Option<serde_json::Value>,
    #[serde(default)]
    output: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

// ============================================================================
// SSE Event Types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum EventPayload {
    #[serde(rename = "message.part.updated")]
    MessagePartUpdated { properties: PartUpdateProperties },
    #[serde(rename = "session.status")]
    SessionStatus { properties: SessionStatusProperties },
    #[serde(rename = "session.error")]
    SessionError { properties: SessionErrorProperties },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct PartUpdateProperties {
    part: PartResponse,
    #[serde(default)]
    delta: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SessionStatusProperties {
    #[serde(rename = "sessionID")]
    session_id: String,
    status: SessionStatusValue,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum SessionStatusValue {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "busy")]
    Busy,
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct SessionErrorProperties {
    #[serde(rename = "sessionID")]
    session_id: Option<String>,
    error: Option<serde_json::Value>,
}

// ============================================================================
// Provider / Model listing types
// ============================================================================

#[derive(Debug, Deserialize)]
struct ProviderListResponse {
    all: Vec<ProviderEntry>,
    #[serde(default)]
    connected: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ProviderEntry {
    id: String,
    name: String,
    #[serde(default)]
    models: std::collections::HashMap<String, ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
    name: String,
    #[serde(default)]
    capabilities: Option<ModelCapabilities>,
}

#[derive(Debug, Deserialize)]
struct ModelCapabilities {
    #[serde(default)]
    toolcall: bool,
}

// ============================================================================
// Convert system/user/assistant messages to OpenCode text parts
// ============================================================================

/// Extract the system message from the conversation (if any).
fn extract_system_message(messages: &[ChatMessage], _tools: &[ToolDefinition]) -> Option<String> {
    messages
        .iter()
        .find(|m| m.role == ChatRole::System)
        .and_then(|m| m.content.clone())
}

/// Build the user prompt from non-system messages only.
fn build_prompt(messages: &[ChatMessage], _tools: &[ToolDefinition]) -> String {
    // Only include the last user message — OpenCode manages conversation history itself
    messages
        .iter()
        .rev()
        .find(|m| m.role == ChatRole::User)
        .and_then(|m| m.content.clone())
        .unwrap_or_default()
}

#[async_trait]
impl AIProvider for OpenCodeProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::OpenCode
    }

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError> {
        // 1. Create a session
        let session = self.create_session().await?;

        // 2. Build the prompt and extract system message
        let prompt = build_prompt(&messages, tools);
        let system = extract_system_message(&messages, tools);

        // 3. Parse model ref and fetch available tools
        let model_ref = parse_model_ref(model);
        let opencode_tools = self.fetch_tool_ids().await;

        // 4. Send message (blocking endpoint)
        let request = MessageRequest {
            parts: vec![TextPartInput {
                part_type: "text".to_string(),
                text: prompt,
            }],
            model: model_ref,
            system,
            tools: opencode_tools,
        };

        let response = self
            .client
            .post(self.url(&format!("/session/{}/message", session.id)))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AIProviderError::new(format!("Request failed: {}", e)).retryable())?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| AIProviderError::new(format!("Failed to read response: {}", e)))?;

        if !status.is_success() {
            return Err(AIProviderError::new(format!(
                "OpenCode API error ({}): {}",
                status, body
            )));
        }

        let msg_response: MessageResponse = serde_json::from_str(&body)
            .map_err(|e| AIProviderError::new(format!("Failed to parse response: {}", e)))?;

        // Check for error in response
        if let Some(error) = msg_response.info.error {
            let error_msg = error
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return Err(AIProviderError::new(error_msg));
        }

        // Extract text content and tool calls from parts
        let mut content_parts: Vec<String> = Vec::new();
        let mut tool_calls: Vec<ToolCall> = Vec::new();

        for part in msg_response.parts {
            match part {
                PartResponse::Text { text, synthetic } => {
                    if synthetic.unwrap_or(false) {
                        continue;
                    }
                    if !text.is_empty() {
                        content_parts.push(text);
                    }
                }
                PartResponse::Tool {
                    call_id,
                    tool,
                    state,
                } => {
                    let arguments = state
                        .input
                        .map(|v| serde_json::to_string(&v).unwrap_or_default())
                        .unwrap_or_default();
                    tool_calls.push(ToolCall {
                        id: call_id,
                        name: tool,
                        arguments,
                    });
                }
                PartResponse::Other => {}
            }
        }

        let content = if content_parts.is_empty() {
            None
        } else {
            Some(content_parts.join("\n"))
        };

        let finish_reason = if !tool_calls.is_empty() {
            FinishReason::ToolCalls
        } else {
            FinishReason::Stop
        };

        Ok(ChatResponse {
            content,
            tool_calls,
            finish_reason,
        })
    }

    async fn chat_stream(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<mpsc::Receiver<StreamChunk>, AIProviderError> {
        // 1. Create a session
        let session_id = self.create_session().await?.id;

        // 2. Build the prompt and extract system message
        let prompt = build_prompt(&messages, tools);
        let system = extract_system_message(&messages, tools);

        // 3. Parse model ref and fetch available tools
        let model_ref = parse_model_ref(model);
        let opencode_tools = self.fetch_tool_ids().await;

        // 4. Connect to SSE event stream first
        let event_url = self.url("/event");
        let sse_response = self.client.get(&event_url).send().await.map_err(|e| {
            AIProviderError::new(format!("Failed to connect to event stream: {}", e))
        })?;

        if !sse_response.status().is_success() {
            return Err(AIProviderError::new(format!(
                "Failed to connect to event stream ({})",
                sse_response.status()
            )));
        }

        // 5. Send the message asynchronously
        let request = MessageRequest {
            parts: vec![TextPartInput {
                part_type: "text".to_string(),
                text: prompt,
            }],
            model: model_ref,
            system,
            tools: opencode_tools,
        };

        let prompt_url = self.url(&format!("/session/{}/prompt_async", session_id));
        let prompt_response = self
            .client
            .post(&prompt_url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AIProviderError::new(format!("Failed to send message: {}", e)))?;

        if !prompt_response.status().is_success() {
            let body = prompt_response.text().await.unwrap_or_default();
            return Err(AIProviderError::new(format!(
                "Failed to send message: {}",
                body
            )));
        }

        // 6. Spawn a task to process SSE events
        let (tx, rx) = mpsc::channel(100);
        let target_session_id = session_id.clone();

        let mut stream = sse_response.bytes_stream();
        tokio::spawn(async move {
            use futures_util::StreamExt;

            let mut buffer = String::new();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        buffer.push_str(&chunk_str);

                        // Process complete SSE events (separated by double newline)
                        while let Some(pos) = buffer.find("\n\n") {
                            let event_block = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            // Extract data field from SSE event
                            let mut data_str = String::new();
                            for line in event_block.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    data_str.push_str(data);
                                } else if let Some(data) = line.strip_prefix("data:") {
                                    data_str.push_str(data);
                                }
                            }

                            if data_str.trim().is_empty() {
                                continue;
                            }

                            // Parse as raw JSON to inspect structure
                            let raw_value: serde_json::Value = match serde_json::from_str(&data_str)
                            {
                                Ok(v) => v,
                                Err(_) => {
                                    continue;
                                }
                            };

                            // Events may be wrapped as GlobalEvent {directory, payload}
                            // or sent directly as the payload. Unwrap accordingly.
                            let payload_value = if raw_value.get("payload").is_some() {
                                raw_value.get("payload").unwrap().clone()
                            } else {
                                raw_value.clone()
                            };

                            // Extract session ID from various locations
                            let event_session_id =
                                payload_value.get("properties").and_then(|props| {
                                    props
                                        .get("sessionID")
                                        .and_then(|s| s.as_str())
                                        .or_else(|| {
                                            props
                                                .get("part")
                                                .and_then(|part| part.get("sessionID"))
                                                .and_then(|s| s.as_str())
                                        })
                                        .or_else(|| {
                                            props
                                                .get("info")
                                                .and_then(|info| info.get("sessionID"))
                                                .and_then(|s| s.as_str())
                                        })
                                });

                            // Skip events not related to our session
                            if let Some(sid) = event_session_id {
                                if sid != target_session_id {
                                    continue;
                                }
                            }

                            // Parse the payload into typed event
                            let event_payload: EventPayload =
                                match serde_json::from_value(payload_value) {
                                    Ok(e) => e,
                                    Err(_) => {
                                        continue;
                                    }
                                };

                            match event_payload {
                                EventPayload::MessagePartUpdated { properties } => {
                                    match &properties.part {
                                        PartResponse::Text { synthetic, .. } => {
                                            if synthetic.unwrap_or(false) {
                                                continue;
                                            }

                                            // Only send deltas for streaming — this filters out:
                                            // 1. User message echo events (no delta)
                                            // 2. Final accumulated text events (no delta)
                                            if let Some(delta) = &properties.delta {
                                                if !delta.is_empty() {
                                                    let _ = tx
                                                        .send(StreamChunk::Content(delta.clone()))
                                                        .await;
                                                }
                                            }
                                        }
                                        PartResponse::Tool {
                                            call_id,
                                            tool,
                                            state,
                                        } => match state.status.as_str() {
                                            "pending" | "running" => {
                                                let args = state
                                                    .input
                                                    .as_ref()
                                                    .map(|v| {
                                                        serde_json::to_string(v).unwrap_or_default()
                                                    })
                                                    .unwrap_or_default();
                                                let _ = tx
                                                    .send(StreamChunk::ToolCallStart {
                                                        id: call_id.clone(),
                                                        name: tool.clone(),
                                                    })
                                                    .await;
                                                if !args.is_empty() && args != "{}" {
                                                    let _ = tx
                                                        .send(StreamChunk::ToolCallDelta {
                                                            id: call_id.clone(),
                                                            arguments: args,
                                                        })
                                                        .await;
                                                }
                                            }
                                            _ => {}
                                        },
                                        PartResponse::Other => {}
                                    }
                                }
                                EventPayload::SessionStatus { properties } => {
                                    if properties.session_id == target_session_id {
                                        if matches!(properties.status, SessionStatusValue::Idle) {
                                            let _ = tx
                                                .send(StreamChunk::Done {
                                                    finish_reason: FinishReason::Stop,
                                                })
                                                .await;
                                            return;
                                        }
                                    }
                                }
                                EventPayload::SessionError { properties } => {
                                    if properties.session_id.as_deref() == Some(&target_session_id)
                                    {
                                        let error_msg = properties
                                            .error
                                            .and_then(|e| {
                                                e.get("message")
                                                    .and_then(|m| m.as_str())
                                                    .map(|s| s.to_string())
                                            })
                                            .unwrap_or_else(|| "Unknown error".to_string());
                                        let _ = tx.send(StreamChunk::Error(error_msg)).await;
                                        return;
                                    }
                                }
                                EventPayload::Other => {}
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                        return;
                    }
                }
            }
        });

        Ok(rx)
    }
}

impl OpenCodeProvider {
    async fn create_session(&self) -> Result<OpenCodeSession, AIProviderError> {
        let response = self
            .client
            .post(self.url("/session"))
            .header("Content-Type", "application/json")
            .json(&CreateSessionRequest {
                title: Some("QueryStudio Chat".to_string()),
            })
            .send()
            .await
            .map_err(|e| AIProviderError::new(format!("Failed to create session: {}", e)))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| AIProviderError::new(format!("Failed to read response: {}", e)))?;

        if !status.is_success() {
            return Err(AIProviderError::new(format!(
                "Failed to create session ({}): {}",
                status, body
            )));
        }

        serde_json::from_str(&body)
            .map_err(|e| AIProviderError::new(format!("Failed to parse session: {}", e)))
    }

    /// Fetch available tool IDs from the experimental endpoint and return
    /// a map enabling all of them.
    async fn fetch_tool_ids(&self) -> Option<std::collections::HashMap<String, bool>> {
        let response = self
            .client
            .get(self.url("/experimental/tool/ids"))
            .send()
            .await
            .ok()?;

        if !response.status().is_success() {
            return None;
        }

        let ids: Vec<String> = response.json().await.ok()?;
        if ids.is_empty() {
            return None;
        }

        let mut map = std::collections::HashMap::new();
        for id in ids {
            map.insert(id, true);
        }
        Some(map)
    }
}

/// Parse an AIModel into an OpenCode model reference.
/// OpenCode models are formatted as "opencode/provider_id/model_id"
/// The api_model_id() returns "provider_id/model_id".
fn parse_model_ref(model: &AIModel) -> Option<ModelRef> {
    let slug = model.api_model_id();
    let parts: Vec<&str> = slug.splitn(2, '/').collect();
    if parts.len() == 2 {
        Some(ModelRef {
            provider_id: parts[0].to_string(),
            model_id: parts[1].to_string(),
        })
    } else {
        // Single slug — let OpenCode pick the provider
        None
    }
}

// ============================================================================
// Model Fetching
// ============================================================================

/// Fetches available models from a running OpenCode server.
/// `base_url` is the server URL (e.g. "http://127.0.0.1:4096").
pub async fn fetch_models(base_url: &str) -> Result<Vec<ModelInfo>, AIProviderError> {
    let base_url = base_url.trim_end_matches('/');
    let client = Client::new();

    let response = client
        .get(format!("{}/provider", base_url))
        .send()
        .await
        .map_err(|e| {
            AIProviderError::new(format!("Failed to connect to OpenCode server: {}", e))
        })?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AIProviderError::new(format!(
            "Failed to fetch providers ({}): {}",
            status, body
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|e| AIProviderError::new(format!("Failed to read response: {}", e)))?;

    let provider_list: ProviderListResponse = serde_json::from_str(&body)
        .map_err(|e| AIProviderError::new(format!("Failed to parse providers response: {}", e)))?;

    let mut models: Vec<ModelInfo> = Vec::new();

    for provider in &provider_list.all {
        let is_connected = provider_list.connected.contains(&provider.id);
        if !is_connected {
            continue;
        }

        for (_model_key, model_entry) in &provider.models {
            // Use provider_id/model_id as the model slug
            let model_id = format!("opencode/{}/{}", provider.id, model_entry.id);
            let display_name = if model_entry.name.is_empty() {
                format!("{}/{}", provider.name, model_entry.id)
            } else {
                model_entry.name.clone()
            };

            models.push(ModelInfo {
                id: model_id,
                name: display_name,
                provider: AIProviderType::OpenCode,
                logo_provider: Some(provider.id.clone()),
            });
        }
    }

    models.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(models)
}
