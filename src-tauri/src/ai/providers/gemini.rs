use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, ChatRole,
    FinishReason, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

const GEMINI_API_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/";

pub struct GeminiProvider {
    client: Client,
    api_key: String,
}

impl GeminiProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    fn get_model_name(model: &AIModel) -> &'static str {
        match model {
            AIModel::Gemini3Flash => "gemini-3-flash-preview",
            AIModel::Gemini3Pro => "gemini-3-pro-preview",
            _ => "gemini-3-flash-preview",
        }
    }
}

// ============================================================================
// Request Types
// ============================================================================

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<GeminiTool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_config: Option<GeminiToolConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(rename = "thinkingConfig", skip_serializing_if = "Option::is_none")]
    thinking_config: Option<GeminiThinkingConfig>,
}

#[derive(Debug, Serialize)]
struct GeminiThinkingConfig {
    #[serde(rename = "thinkingBudget")]
    thinking_budget: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum GeminiPart {
    Text {
        text: String,
        #[serde(rename = "thoughtSignature", skip_serializing_if = "Option::is_none")]
        thought_signature: Option<String>,
    },
    FunctionCall {
        #[serde(rename = "functionCall")]
        function_call: GeminiFunctionCall,
        #[serde(rename = "thoughtSignature", skip_serializing_if = "Option::is_none")]
        thought_signature: Option<String>,
    },
    FunctionResponse {
        #[serde(rename = "functionResponse")]
        function_response: GeminiFunctionResponse,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GeminiFunctionCall {
    name: String,
    args: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiFunctionResponse {
    name: String,
    response: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct GeminiTool {
    #[serde(rename = "functionDeclarations")]
    function_declarations: Vec<GeminiFunctionDeclaration>,
}

#[derive(Debug, Serialize)]
struct GeminiFunctionDeclaration {
    name: String,
    description: String,
    parameters: GeminiParameters,
}

#[derive(Debug, Serialize)]
struct GeminiParameters {
    #[serde(rename = "type")]
    param_type: String,
    properties: serde_json::Value,
    required: Vec<String>,
}

#[derive(Debug, Serialize)]
struct GeminiToolConfig {
    #[serde(rename = "functionCallingConfig")]
    function_calling_config: GeminiFunctionCallingConfig,
}

#[derive(Debug, Serialize)]
struct GeminiFunctionCallingConfig {
    mode: String,
}

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    error: Option<GeminiError>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiError {
    message: String,
    #[serde(default)]
    status: Option<String>,
}

// ============================================================================
// Streaming Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct GeminiStreamResponse {
    candidates: Option<Vec<GeminiStreamCandidate>>,
}

#[derive(Debug, Deserialize)]
struct GeminiStreamCandidate {
    content: Option<GeminiStreamContent>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiStreamContent {
    #[serde(default)]
    parts: Vec<GeminiStreamPart>,
}

#[derive(Debug, Deserialize)]
struct GeminiStreamPart {
    #[serde(default)]
    text: Option<String>,
    #[serde(rename = "functionCall")]
    function_call: Option<GeminiFunctionCall>,
}

// ============================================================================
// Conversion Functions
// ============================================================================

fn convert_role(role: &ChatRole) -> String {
    match role {
        ChatRole::System => "user".to_string(), // Gemini doesn't have system role, use user
        ChatRole::User => "user".to_string(),
        ChatRole::Assistant => "model".to_string(),
        ChatRole::Tool => "user".to_string(), // Tool responses go as user role with functionResponse
    }
}

fn convert_message(msg: &ChatMessage) -> GeminiContent {
    let role = convert_role(&msg.role);

    // Handle tool result messages
    if msg.role == ChatRole::Tool {
        if let (Some(tool_call_id), Some(content)) = (&msg.tool_call_id, &msg.content) {
            // Extract the function name from tool_call_id (format: "name_id")
            let name = tool_call_id
                .split('_')
                .next()
                .unwrap_or(tool_call_id)
                .to_string();
            return GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart::FunctionResponse {
                    function_response: GeminiFunctionResponse {
                        name,
                        response: serde_json::json!({ "result": content }),
                    },
                }],
            };
        }
    }

    // Handle assistant messages with tool calls
    if let Some(tool_calls) = &msg.tool_calls {
        let parts: Vec<GeminiPart> = tool_calls
            .iter()
            .map(|tc| {
                let args: serde_json::Value =
                    serde_json::from_str(&tc.arguments).unwrap_or(serde_json::json!({}));
                GeminiPart::FunctionCall {
                    function_call: GeminiFunctionCall {
                        name: tc.name.clone(),
                        args,
                    },
                    // Add dummy thought_signature to bypass validation for Gemini 3
                    thought_signature: Some("context_engineering_is_the_way_to_go".to_string()),
                }
            })
            .collect();
        return GeminiContent { role, parts };
    }

    // Handle regular text messages
    GeminiContent {
        role,
        parts: vec![GeminiPart::Text {
            text: msg.content.clone().unwrap_or_default(),
            thought_signature: None,
        }],
    }
}

fn convert_tool(tool: &ToolDefinition) -> GeminiFunctionDeclaration {
    GeminiFunctionDeclaration {
        name: tool.name.clone(),
        description: tool.description.clone(),
        parameters: GeminiParameters {
            param_type: tool.parameters.param_type.to_lowercase(),
            properties: tool.parameters.properties.clone(),
            required: tool.parameters.required.clone(),
        },
    }
}

fn parse_finish_reason(reason: Option<&str>) -> FinishReason {
    match reason {
        Some("STOP") => FinishReason::Stop,
        Some("MAX_TOKENS") => FinishReason::Length,
        Some("SAFETY") => FinishReason::ContentFilter,
        Some("RECITATION") => FinishReason::ContentFilter,
        Some("TOOL_USE") => FinishReason::ToolCalls,
        _ => FinishReason::Unknown,
    }
}

// ============================================================================
// AIProvider Implementation
// ============================================================================

#[async_trait]
impl AIProvider for GeminiProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::Google
    }

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError> {
        let model_name = Self::get_model_name(model);
        let url = format!(
            "{}{}:generateContent?key={}",
            GEMINI_API_URL, model_name, self.api_key
        );

        let contents: Vec<GeminiContent> = messages.iter().map(convert_message).collect();

        let gemini_tools = if tools.is_empty() {
            None
        } else {
            Some(vec![GeminiTool {
                function_declarations: tools.iter().map(convert_tool).collect(),
            }])
        };

        let tool_config = if tools.is_empty() {
            None
        } else {
            Some(GeminiToolConfig {
                function_calling_config: GeminiFunctionCallingConfig {
                    mode: "AUTO".to_string(),
                },
            })
        };

        // Disable thinking to avoid thought_signature requirements for function calling
        let generation_config = Some(GeminiGenerationConfig {
            thinking_config: Some(GeminiThinkingConfig { thinking_budget: 0 }),
        });

        let request = GeminiRequest {
            contents,
            tools: gemini_tools,
            tool_config,
            generation_config,
        };

        let response = self
            .client
            .post(&url)
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
            if let Ok(error_response) = serde_json::from_str::<GeminiResponse>(&body) {
                if let Some(error) = error_response.error {
                    let mut err = AIProviderError::new(&error.message);
                    if let Some(status_str) = error.status {
                        err = err.with_type(status_str);
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

        let gemini_response: GeminiResponse = serde_json::from_str(&body)
            .map_err(|e| AIProviderError::new(format!("Failed to parse response: {}", e)))?;

        if let Some(error) = gemini_response.error {
            return Err(AIProviderError::new(&error.message));
        }

        let candidate = gemini_response
            .candidates
            .and_then(|c| c.into_iter().next())
            .ok_or_else(|| AIProviderError::new("No response candidates"))?;

        let content = candidate
            .content
            .ok_or_else(|| AIProviderError::new("No content in response"))?;

        let mut text_content = String::new();
        let mut tool_calls = Vec::new();
        let mut tool_call_index = 0;

        for part in content.parts {
            match part {
                GeminiPart::Text { text, .. } => {
                    text_content.push_str(&text);
                }
                GeminiPart::FunctionCall { function_call, .. } => {
                    tool_calls.push(ToolCall {
                        id: format!("{}_{}", function_call.name, tool_call_index),
                        name: function_call.name,
                        arguments: serde_json::to_string(&function_call.args).unwrap_or_default(),
                    });
                    tool_call_index += 1;
                }
                _ => {}
            }
        }

        let finish_reason = if !tool_calls.is_empty() {
            FinishReason::ToolCalls
        } else {
            parse_finish_reason(candidate.finish_reason.as_deref())
        };

        Ok(ChatResponse {
            content: if text_content.is_empty() {
                None
            } else {
                Some(text_content)
            },
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
        println!("[Gemini] chat_stream called with model: {}", model);
        println!(
            "[Gemini] messages count: {}, tools count: {}",
            messages.len(),
            tools.len()
        );

        let model_name = Self::get_model_name(model);
        let url = format!(
            "{}{}:streamGenerateContent?alt=sse&key={}",
            GEMINI_API_URL, model_name, self.api_key
        );

        let contents: Vec<GeminiContent> = messages.iter().map(convert_message).collect();

        let gemini_tools = if tools.is_empty() {
            None
        } else {
            Some(vec![GeminiTool {
                function_declarations: tools.iter().map(convert_tool).collect(),
            }])
        };

        let tool_config = if tools.is_empty() {
            None
        } else {
            Some(GeminiToolConfig {
                function_calling_config: GeminiFunctionCallingConfig {
                    mode: "AUTO".to_string(),
                },
            })
        };

        // Disable thinking to avoid thought_signature requirements for function calling
        let generation_config = Some(GeminiGenerationConfig {
            thinking_config: Some(GeminiThinkingConfig { thinking_budget: 0 }),
        });

        let request = GeminiRequest {
            contents,
            tools: gemini_tools,
            tool_config,
            generation_config,
        };

        println!("[Gemini] Sending request to {}", url);
        println!(
            "[Gemini] Request body: {}",
            serde_json::to_string_pretty(&request).unwrap_or_default()
        );
        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                println!("[Gemini] Request failed: {}", e);
                AIProviderError::new(format!("Request failed: {}", e)).retryable()
            })?;

        let status = response.status();
        println!("[Gemini] Response status: {}", status);

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            println!("[Gemini] Error body: {}", body);
            if let Ok(error_response) = serde_json::from_str::<GeminiResponse>(&body) {
                if let Some(error) = error_response.error {
                    return Err(AIProviderError::new(&error.message));
                }
            }
            return Err(AIProviderError::new(format!(
                "API error ({}): {}",
                status, body
            )));
        }

        println!("[Gemini] Response successful, setting up stream");

        let (tx, rx) = mpsc::channel(100);

        let mut stream = response.bytes_stream();
        println!("[Gemini] Spawning stream processing task");

        tokio::spawn(async move {
            use futures_util::StreamExt;

            println!("[Gemini] Stream processing task started");
            let mut buffer = String::new();
            let mut current_tool_calls: std::collections::HashMap<usize, (String, String, String)> =
                std::collections::HashMap::new();
            let mut tool_call_index = 0;

            let mut chunk_count = 0;
            while let Some(chunk_result) = stream.next().await {
                chunk_count += 1;
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        println!(
                            "[Gemini] Received chunk #{}: {} bytes, content: {}",
                            chunk_count,
                            chunk.len(),
                            &chunk_str[..std::cmp::min(500, chunk_str.len())]
                        );
                        buffer.push_str(&chunk_str);

                        // Process SSE events (handle both \n\n and \r\n\r\n)
                        while let Some(pos) =
                            buffer.find("\n\n").or_else(|| buffer.find("\r\n\r\n"))
                        {
                            let delimiter_len = if buffer[pos..].starts_with("\r\n\r\n") {
                                4
                            } else {
                                2
                            };
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + delimiter_len..].to_string();

                            println!(
                                "[Gemini] Processing event: {}",
                                &event[..std::cmp::min(200, event.len())]
                            );

                            for line in event.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if let Ok(response) =
                                        serde_json::from_str::<GeminiStreamResponse>(data)
                                    {
                                        if let Some(candidates) = response.candidates {
                                            for candidate in candidates {
                                                if let Some(content) = candidate.content {
                                                    for part in content.parts {
                                                        if let Some(text) = part.text {
                                                            if !text.is_empty() {
                                                                let _ = tx
                                                                    .send(StreamChunk::Content(
                                                                        text,
                                                                    ))
                                                                    .await;
                                                            }
                                                        }

                                                        if let Some(fc) = part.function_call {
                                                            let id = format!(
                                                                "{}_{}",
                                                                fc.name, tool_call_index
                                                            );
                                                            let args =
                                                                serde_json::to_string(&fc.args)
                                                                    .unwrap_or_default();

                                                            // Send tool call start
                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallStart {
                                                                    id: id.clone(),
                                                                    name: fc.name.clone(),
                                                                })
                                                                .await;

                                                            // Send tool call arguments
                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallDelta {
                                                                    id: id.clone(),
                                                                    arguments: args.clone(),
                                                                })
                                                                .await;

                                                            current_tool_calls.insert(
                                                                tool_call_index,
                                                                (id, fc.name, args),
                                                            );
                                                            tool_call_index += 1;
                                                        }
                                                    }
                                                }

                                                if let Some(reason) = candidate.finish_reason {
                                                    println!(
                                                        "[Gemini] Finish reason received: {}",
                                                        reason
                                                    );
                                                    let parsed_reason =
                                                        if !current_tool_calls.is_empty() {
                                                            FinishReason::ToolCalls
                                                        } else {
                                                            parse_finish_reason(Some(&reason))
                                                        };
                                                    println!(
                                                        "[Gemini] Parsed finish reason: {:?}",
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
                    }
                    Err(e) => {
                        println!("[Gemini] Stream error: {}", e);
                        let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                        return;
                    }
                }
            }
            println!(
                "[Gemini] Stream processing task finished after {} chunks",
                chunk_count
            );
        });

        println!("[Gemini] Returning receiver");
        Ok(rx)
    }
}
