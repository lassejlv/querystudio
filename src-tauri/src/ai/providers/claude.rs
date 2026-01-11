use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, ChatRole,
    FinishReason, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct ClaudeProvider {
    client: Client,
    api_key: String,
}

impl ClaudeProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<AnthropicTool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AnthropicMessage {
    role: String,
    content: AnthropicContent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
enum AnthropicContent {
    Text(String),
    Blocks(Vec<AnthropicContentBlock>),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum AnthropicContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
    },
}

#[derive(Debug, Serialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicResponseContent>,
    stop_reason: Option<String>,
    #[serde(default)]
    error: Option<AnthropicError>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum AnthropicResponseContent {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
}

#[derive(Debug, Deserialize)]
struct AnthropicError {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    index: Option<usize>,
    #[serde(default)]
    content_block: Option<AnthropicStreamContentBlock>,
    #[serde(default)]
    delta: Option<AnthropicStreamDelta>,
    #[serde(default)]
    message: Option<AnthropicStreamMessage>,
    #[serde(default)]
    error: Option<AnthropicError>,
}

#[derive(Debug, Deserialize)]
struct AnthropicStreamMessage {
    #[serde(default)]
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum AnthropicStreamContentBlock {
    Text { text: String },
    ToolUse { id: String, name: String },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
enum AnthropicStreamDelta {
    TextDelta {
        text: String,
    },
    InputJsonDelta {
        partial_json: String,
    },
    #[serde(other)]
    Unknown,
}

fn convert_messages(messages: &[ChatMessage]) -> (Option<String>, Vec<AnthropicMessage>) {
    let mut system_prompt = None;
    let mut anthropic_messages = Vec::new();

    for msg in messages {
        match msg.role {
            ChatRole::System => {
                system_prompt = msg.content.clone();
            }
            ChatRole::User => {
                if let Some(content) = &msg.content {
                    anthropic_messages.push(AnthropicMessage {
                        role: "user".to_string(),
                        content: AnthropicContent::Text(content.clone()),
                    });
                }
            }
            ChatRole::Assistant => {
                let mut blocks = Vec::new();

                if let Some(content) = &msg.content {
                    if !content.is_empty() {
                        blocks.push(AnthropicContentBlock::Text {
                            text: content.clone(),
                        });
                    }
                }

                if let Some(tool_calls) = &msg.tool_calls {
                    for tc in tool_calls {
                        let input: serde_json::Value =
                            serde_json::from_str(&tc.arguments).unwrap_or(serde_json::json!({}));
                        blocks.push(AnthropicContentBlock::ToolUse {
                            id: tc.id.clone(),
                            name: tc.name.clone(),
                            input,
                        });
                    }
                }

                if !blocks.is_empty() {
                    anthropic_messages.push(AnthropicMessage {
                        role: "assistant".to_string(),
                        content: AnthropicContent::Blocks(blocks),
                    });
                }
            }
            ChatRole::Tool => {
                if let (Some(tool_call_id), Some(content)) = (&msg.tool_call_id, &msg.content) {
                    anthropic_messages.push(AnthropicMessage {
                        role: "user".to_string(),
                        content: AnthropicContent::Blocks(vec![
                            AnthropicContentBlock::ToolResult {
                                tool_use_id: tool_call_id.clone(),
                                content: content.clone(),
                            },
                        ]),
                    });
                }
            }
        }
    }

    (system_prompt, anthropic_messages)
}

fn convert_tool(tool: &ToolDefinition) -> AnthropicTool {
    AnthropicTool {
        name: tool.name.clone(),
        description: tool.description.clone(),
        input_schema: serde_json::json!({
            "type": tool.parameters.param_type,
            "properties": tool.parameters.properties,
            "required": tool.parameters.required,
        }),
    }
}

fn parse_finish_reason(reason: Option<&str>) -> FinishReason {
    match reason {
        Some("end_turn") => FinishReason::Stop,
        Some("stop_sequence") => FinishReason::Stop,
        Some("tool_use") => FinishReason::ToolCalls,
        Some("max_tokens") => FinishReason::Length,
        _ => FinishReason::Unknown,
    }
}

#[async_trait]
impl AIProvider for ClaudeProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::Anthropic
    }

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError> {
        let (system_prompt, anthropic_messages) = convert_messages(&messages);
        let anthropic_tools: Vec<AnthropicTool> = tools.iter().map(convert_tool).collect();

        let request = AnthropicRequest {
            model: model.to_string(),
            max_tokens: 8192,
            system: system_prompt,
            messages: anthropic_messages,
            tools: anthropic_tools,
            stream: None,
        };

        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
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
            if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(error) = error_response.get("error") {
                    let message = error
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    let error_type = error
                        .get("type")
                        .and_then(|t| t.as_str())
                        .map(|s| s.to_string());

                    let mut err = AIProviderError::new(message);
                    if let Some(t) = error_type {
                        err = err.with_type(t);
                    }
                    if status.as_u16() == 429 || status.as_u16() >= 500 {
                        err = err.retryable();
                    }
                    return Err(err);
                }
            }
            return Err(AIProviderError::new(format!(
                "API error ({}): {}",
                status, body
            )));
        }

        let anthropic_response: AnthropicResponse = serde_json::from_str(&body)
            .map_err(|e| AIProviderError::new(format!("Failed to parse response: {}", e)))?;

        if let Some(error) = anthropic_response.error {
            let mut err = AIProviderError::new(&error.message);
            if let Some(t) = error.error_type {
                err = err.with_type(t);
            }
            return Err(err);
        }

        let mut content = String::new();
        let mut tool_calls = Vec::new();

        for block in anthropic_response.content {
            match block {
                AnthropicResponseContent::Text { text } => {
                    content.push_str(&text);
                }
                AnthropicResponseContent::ToolUse { id, name, input } => {
                    tool_calls.push(ToolCall {
                        id,
                        name,
                        arguments: input.to_string(),
                    });
                }
            }
        }

        Ok(ChatResponse {
            content: if content.is_empty() {
                None
            } else {
                Some(content)
            },
            tool_calls,
            finish_reason: parse_finish_reason(anthropic_response.stop_reason.as_deref()),
        })
    }

    async fn chat_stream(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<mpsc::Receiver<StreamChunk>, AIProviderError> {
        println!("[Claude] chat_stream called with model: {}", model);
        println!(
            "[Claude] messages count: {}, tools count: {}",
            messages.len(),
            tools.len()
        );

        let (system_prompt, anthropic_messages) = convert_messages(&messages);
        let anthropic_tools: Vec<AnthropicTool> = tools.iter().map(convert_tool).collect();

        let request = AnthropicRequest {
            model: model.to_string(),
            max_tokens: 8192,
            system: system_prompt,
            messages: anthropic_messages,
            tools: anthropic_tools,
            stream: Some(true),
        };

        println!("[Claude] Sending request to {}", ANTHROPIC_API_URL);
        let response = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                println!("[Claude] Request failed: {}", e);
                AIProviderError::new(format!("Request failed: {}", e)).retryable()
            })?;

        let status = response.status();
        println!("[Claude] Response status: {}", status);

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            println!("[Claude] Error body: {}", body);
            if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(error) = error_response.get("error") {
                    let message = error
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    return Err(AIProviderError::new(message));
                }
            }
            return Err(AIProviderError::new(format!(
                "API error ({}): {}",
                status, body
            )));
        }

        println!("[Claude] Response successful, setting up stream");

        let (tx, rx) = mpsc::channel(100);

        let mut stream = response.bytes_stream();
        println!("[Claude] Spawning stream processing task");
        tokio::spawn(async move {
            use futures_util::StreamExt;

            println!("[Claude] Stream processing task started");
            let mut buffer = String::new();
            let mut current_tool_id: Option<String> = None;
            #[allow(unused_assignments)]
            let mut _current_tool_name: Option<String> = None;

            let mut chunk_count = 0;
            while let Some(chunk_result) = stream.next().await {
                chunk_count += 1;
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        println!(
                            "[Claude] Received chunk #{}: {} bytes",
                            chunk_count,
                            chunk.len()
                        );
                        buffer.push_str(&chunk_str);

                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            for line in event.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if let Ok(event) =
                                        serde_json::from_str::<AnthropicStreamEvent>(data)
                                    {
                                        match event.event_type.as_str() {
                                            "content_block_start" => {
                                                if let Some(content_block) = event.content_block {
                                                    match content_block {
                                                        AnthropicStreamContentBlock::Text {
                                                            ..
                                                        } => {
                                                            // Text block starting, nothing to emit yet
                                                        }
                                                        AnthropicStreamContentBlock::ToolUse {
                                                            id,
                                                            name,
                                                        } => {
                                                            println!(
                                                                "[Claude] Tool use started: {} ({})",
                                                                name, id
                                                            );
                                                            current_tool_id = Some(id.clone());
                                                            _current_tool_name = Some(name.clone());
                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallStart {
                                                                    id,
                                                                    name,
                                                                })
                                                                .await;
                                                        }
                                                    }
                                                }
                                            }
                                            "content_block_delta" => {
                                                if let Some(delta) = event.delta {
                                                    match delta {
                                                        AnthropicStreamDelta::TextDelta {
                                                            text,
                                                        } => {
                                                            if !text.is_empty() {
                                                                let _ = tx
                                                                    .send(StreamChunk::Content(
                                                                        text,
                                                                    ))
                                                                    .await;
                                                            }
                                                        }
                                                        AnthropicStreamDelta::InputJsonDelta {
                                                            partial_json,
                                                        } => {
                                                            if let Some(ref id) = current_tool_id {
                                                                let _ = tx
                                                                    .send(
                                                                        StreamChunk::ToolCallDelta {
                                                                            id: id.clone(),
                                                                            arguments: partial_json,
                                                                        },
                                                                    )
                                                                    .await;
                                                            }
                                                        }
                                                        AnthropicStreamDelta::Unknown => {}
                                                    }
                                                }
                                            }
                                            "content_block_stop" => {
                                                // Content block finished
                                                current_tool_id = None;
                                                _current_tool_name = None;
                                            }
                                            "message_delta" => {
                                                if let Some(message) = event.message {
                                                    if let Some(reason) = message.stop_reason {
                                                        println!(
                                                            "[Claude] Stop reason: {}",
                                                            reason
                                                        );
                                                        let parsed_reason =
                                                            parse_finish_reason(Some(&reason));
                                                        println!(
                                                            "[Claude] Parsed finish reason: {:?}",
                                                            parsed_reason
                                                        );
                                                        let _ = tx
                                                            .send(StreamChunk::Done {
                                                                finish_reason: parsed_reason,
                                                            })
                                                            .await;
                                                    }
                                                }
                                            }
                                            "message_stop" => {
                                                println!("[Claude] Message stop received");
                                                let _ = tx
                                                    .send(StreamChunk::Done {
                                                        finish_reason: FinishReason::Stop,
                                                    })
                                                    .await;
                                                return;
                                            }
                                            "error" => {
                                                if let Some(error) = event.error {
                                                    println!(
                                                        "[Claude] Stream error: {}",
                                                        error.message
                                                    );
                                                    let _ = tx
                                                        .send(StreamChunk::Error(error.message))
                                                        .await;
                                                    return;
                                                }
                                            }
                                            _ => {
                                                // Ignore other event types (ping, message_start, etc.)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("[Claude] Stream error: {}", e);
                        let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                        return;
                    }
                }
            }
            println!(
                "[Claude] Stream processing task finished after {} chunks",
                chunk_count
            );
        });

        println!("[Claude] Returning receiver");
        Ok(rx)
    }
}
