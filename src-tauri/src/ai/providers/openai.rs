use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, ChatRole,
    FinishReason, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

const OPENAI_API_URL: &str = "https://api.openai.com/v1/chat/completions";

pub struct OpenAIProvider {
    client: Client,
    api_key: String,
}

impl OpenAIProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<OpenAITool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OpenAIToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIToolCall {
    id: String,
    #[serde(rename = "type")]
    call_type: String,
    function: OpenAIFunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OpenAIFunctionCall {
    name: String,
    arguments: String,
}

#[derive(Debug, Serialize)]
struct OpenAITool {
    #[serde(rename = "type")]
    tool_type: String,
    function: OpenAIFunctionDef,
}

#[derive(Debug, Serialize)]
struct OpenAIFunctionDef {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    #[serde(default)]
    error: Option<OpenAIError>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIError {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamResponse {
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIStreamDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<OpenAIStreamToolCall>>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamToolCall {
    index: usize,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    function: Option<OpenAIStreamFunction>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamFunction {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

fn convert_role(role: &ChatRole) -> String {
    match role {
        ChatRole::System => "system".to_string(),
        ChatRole::User => "user".to_string(),
        ChatRole::Assistant => "assistant".to_string(),
        ChatRole::Tool => "tool".to_string(),
    }
}

fn convert_message(msg: &ChatMessage) -> OpenAIMessage {
    OpenAIMessage {
        role: convert_role(&msg.role),
        content: msg.content.clone(),
        tool_calls: msg.tool_calls.as_ref().map(|calls| {
            calls
                .iter()
                .map(|tc| OpenAIToolCall {
                    id: tc.id.clone(),
                    call_type: "function".to_string(),
                    function: OpenAIFunctionCall {
                        name: tc.name.clone(),
                        arguments: tc.arguments.clone(),
                    },
                })
                .collect()
        }),
        tool_call_id: msg.tool_call_id.clone(),
    }
}

fn convert_tool(tool: &ToolDefinition) -> OpenAITool {
    OpenAITool {
        tool_type: "function".to_string(),
        function: OpenAIFunctionDef {
            name: tool.name.clone(),
            description: tool.description.clone(),
            parameters: serde_json::json!({
                "type": tool.parameters.param_type,
                "properties": tool.parameters.properties,
                "required": tool.parameters.required,
            }),
        },
    }
}

fn parse_finish_reason(reason: Option<&str>) -> FinishReason {
    match reason {
        Some("stop") => FinishReason::Stop,
        Some("tool_calls") => FinishReason::ToolCalls,
        Some("length") => FinishReason::Length,
        Some("content_filter") => FinishReason::ContentFilter,
        _ => FinishReason::Unknown,
    }
}

#[async_trait]
impl AIProvider for OpenAIProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::OpenAI
    }

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError> {
        let openai_messages: Vec<OpenAIMessage> = messages.iter().map(convert_message).collect();
        let openai_tools: Vec<OpenAITool> = tools.iter().map(convert_tool).collect();

        let request = OpenAIRequest {
            model: model.to_string(),
            messages: openai_messages,
            tools: openai_tools,
            tool_choice: if tools.is_empty() {
                None
            } else {
                Some("auto".to_string())
            },
            stream: None,
        };

        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
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

        let openai_response: OpenAIResponse = serde_json::from_str(&body)
            .map_err(|e| AIProviderError::new(format!("Failed to parse response: {}", e)))?;

        if let Some(error) = openai_response.error {
            let mut err = AIProviderError::new(&error.message);
            if let Some(t) = error.error_type {
                err = err.with_type(t);
            }
            return Err(err);
        }

        let choice = openai_response
            .choices
            .into_iter()
            .next()
            .ok_or_else(|| AIProviderError::new("No response choices"))?;

        let tool_calls = choice
            .message
            .tool_calls
            .unwrap_or_default()
            .into_iter()
            .map(|tc| ToolCall {
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
            })
            .collect();

        Ok(ChatResponse {
            content: choice.message.content,
            tool_calls,
            finish_reason: parse_finish_reason(choice.finish_reason.as_deref()),
        })
    }

    async fn chat_stream(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<mpsc::Receiver<StreamChunk>, AIProviderError> {
        println!("[OpenAI] chat_stream called with model: {}", model);
        println!(
            "[OpenAI] messages count: {}, tools count: {}",
            messages.len(),
            tools.len()
        );

        let openai_messages: Vec<OpenAIMessage> = messages.iter().map(convert_message).collect();
        let openai_tools: Vec<OpenAITool> = tools.iter().map(convert_tool).collect();

        let request = OpenAIRequest {
            model: model.to_string(),
            messages: openai_messages,
            tools: openai_tools,
            tool_choice: if tools.is_empty() {
                None
            } else {
                Some("auto".to_string())
            },
            stream: Some(true),
        };

        println!("[OpenAI] Sending request to {}", OPENAI_API_URL);
        let response = self
            .client
            .post(OPENAI_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                println!("[OpenAI] Request failed: {}", e);
                AIProviderError::new(format!("Request failed: {}", e)).retryable()
            })?;

        let status = response.status();
        println!("[OpenAI] Response status: {}", status);

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            println!("[OpenAI] Error body: {}", body);
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

        println!("[OpenAI] Response successful, setting up stream");

        let (tx, rx) = mpsc::channel(100);

        let mut stream = response.bytes_stream();
        println!("[OpenAI] Spawning stream processing task");
        tokio::spawn(async move {
            use futures_util::StreamExt;

            println!("[OpenAI] Stream processing task started");
            let mut buffer = String::new();
            let mut current_tool_calls: std::collections::HashMap<usize, (String, String, String)> =
                std::collections::HashMap::new();

            let mut chunk_count = 0;
            while let Some(chunk_result) = stream.next().await {
                chunk_count += 1;
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        println!(
                            "[OpenAI] Received chunk #{}: {} bytes",
                            chunk_count,
                            chunk.len()
                        );
                        buffer.push_str(&chunk_str);

                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            for line in event.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        println!("[OpenAI] Received [DONE] marker");
                                        let _ = tx
                                            .send(StreamChunk::Done {
                                                finish_reason: FinishReason::Stop,
                                            })
                                            .await;
                                        return;
                                    }

                                    if let Ok(response) =
                                        serde_json::from_str::<OpenAIStreamResponse>(data)
                                    {
                                        for choice in response.choices {
                                            if let Some(content) = choice.delta.content {
                                                if !content.is_empty() {
                                                    let _ = tx
                                                        .send(StreamChunk::Content(content))
                                                        .await;
                                                }
                                            }

                                            if let Some(tool_calls) = choice.delta.tool_calls {
                                                for tc in tool_calls {
                                                    if let Some(id) = tc.id {
                                                        let name = tc
                                                            .function
                                                            .as_ref()
                                                            .and_then(|f| f.name.clone())
                                                            .unwrap_or_default();
                                                        current_tool_calls.insert(
                                                            tc.index,
                                                            (
                                                                id.clone(),
                                                                name.clone(),
                                                                String::new(),
                                                            ),
                                                        );
                                                        let _ = tx
                                                            .send(StreamChunk::ToolCallStart {
                                                                id,
                                                                name,
                                                            })
                                                            .await;
                                                    }

                                                    if let Some(args) = tc
                                                        .function
                                                        .as_ref()
                                                        .and_then(|f| f.arguments.clone())
                                                    {
                                                        if let Some((id, _, accumulated)) =
                                                            current_tool_calls.get_mut(&tc.index)
                                                        {
                                                            accumulated.push_str(&args);
                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallDelta {
                                                                    id: id.clone(),
                                                                    arguments: args,
                                                                })
                                                                .await;
                                                        }
                                                    }
                                                }
                                            }

                                            if let Some(reason) = choice.finish_reason {
                                                println!(
                                                    "[OpenAI] Finish reason received: {}",
                                                    reason
                                                );
                                                let parsed_reason =
                                                    parse_finish_reason(Some(&reason));
                                                println!(
                                                    "[OpenAI] Parsed finish reason: {:?}",
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
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("[OpenAI] Stream error: {}", e);
                        let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                        return;
                    }
                }
            }
            println!(
                "[OpenAI] Stream processing task finished after {} chunks",
                chunk_count
            );
        });

        println!("[OpenAI] Returning receiver");
        Ok(rx)
    }
}
