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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiContent>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<GeminiTool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GeminiPart {
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    function_call: Option<GeminiFunctionCall>,
    #[serde(skip_serializing_if = "Option::is_none")]
    function_response: Option<GeminiFunctionResponse>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GeminiFunctionCall {
    name: String,
    args: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GeminiFunctionResponse {
    name: String,
    response: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiTool {
    function_declarations: Vec<GeminiFunctionDeclaration>,
}

#[derive(Debug, Serialize)]
struct GeminiFunctionDeclaration {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    #[serde(default)]
    error: Option<GeminiError>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiCandidate {
    content: Option<GeminiContent>,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiError {
    message: String,
    #[serde(default)]
    status: Option<String>,
}

fn convert_messages(messages: &[ChatMessage]) -> (Option<GeminiContent>, Vec<GeminiContent>) {
    let mut system_instruction = None;
    let mut gemini_contents = Vec::new();

    for msg in messages {
        match msg.role {
            ChatRole::System => {
                if let Some(content) = &msg.content {
                    system_instruction = Some(GeminiContent {
                        role: None,
                        parts: vec![GeminiPart {
                            text: Some(content.clone()),
                            function_call: None,
                            function_response: None,
                        }],
                    });
                }
            }
            ChatRole::User => {
                if let Some(content) = &msg.content {
                    gemini_contents.push(GeminiContent {
                        role: Some("user".to_string()),
                        parts: vec![GeminiPart {
                            text: Some(content.clone()),
                            function_call: None,
                            function_response: None,
                        }],
                    });
                }
            }
            ChatRole::Assistant => {
                let mut parts = Vec::new();

                if let Some(content) = &msg.content {
                    if !content.is_empty() {
                        parts.push(GeminiPart {
                            text: Some(content.clone()),
                            function_call: None,
                            function_response: None,
                        });
                    }
                }

                if let Some(tool_calls) = &msg.tool_calls {
                    for tc in tool_calls {
                        let args: serde_json::Value =
                            serde_json::from_str(&tc.arguments).unwrap_or(serde_json::json!({}));
                        parts.push(GeminiPart {
                            text: None,
                            function_call: Some(GeminiFunctionCall {
                                name: tc.name.clone(),
                                args,
                            }),
                            function_response: None,
                        });
                    }
                }

                if !parts.is_empty() {
                    gemini_contents.push(GeminiContent {
                        role: Some("model".to_string()),
                        parts,
                    });
                }
            }
            ChatRole::Tool => {
                // In Gemini, tool responses go in user role with functionResponse
                if let Some(content) = &msg.content {
                    // Try to parse tool_call_id to get the function name
                    // We'll use the tool_call_id as the name since that's what we have
                    let name = msg.tool_call_id.clone().unwrap_or_default();

                    // Try to parse the content as JSON, otherwise wrap it
                    let response: serde_json::Value = serde_json::from_str(content)
                        .unwrap_or_else(|_| serde_json::json!({ "result": content }));

                    gemini_contents.push(GeminiContent {
                        role: Some("user".to_string()),
                        parts: vec![GeminiPart {
                            text: None,
                            function_call: None,
                            function_response: Some(GeminiFunctionResponse { name, response }),
                        }],
                    });
                }
            }
        }
    }

    (system_instruction, gemini_contents)
}

fn convert_tool(tool: &ToolDefinition) -> GeminiFunctionDeclaration {
    GeminiFunctionDeclaration {
        name: tool.name.clone(),
        description: tool.description.clone(),
        parameters: serde_json::json!({
            "type": tool.parameters.param_type,
            "properties": tool.parameters.properties,
            "required": tool.parameters.required,
        }),
    }
}

fn parse_finish_reason(reason: Option<&str>) -> FinishReason {
    match reason {
        Some("STOP") => FinishReason::Stop,
        Some("MAX_TOKENS") => FinishReason::Length,
        Some("SAFETY") => FinishReason::ContentFilter,
        Some("RECITATION") => FinishReason::ContentFilter,
        Some("TOOL_CODE") | Some("MALFORMED_FUNCTION_CALL") => FinishReason::ToolCalls,
        _ => FinishReason::Unknown,
    }
}

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
        let (system_instruction, gemini_contents) = convert_messages(&messages);
        let gemini_tools: Vec<GeminiTool> = if tools.is_empty() {
            vec![]
        } else {
            vec![GeminiTool {
                function_declarations: tools.iter().map(convert_tool).collect(),
            }]
        };

        let request = GeminiRequest {
            contents: gemini_contents,
            system_instruction,
            tools: gemini_tools,
        };

        let url = format!(
            "{}{}:generateContent?key={}",
            GEMINI_API_URL,
            model.to_string(),
            self.api_key
        );

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
            if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(error) = error_response.get("error") {
                    let message = error
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    let error_status = error
                        .get("status")
                        .and_then(|s| s.as_str())
                        .map(|s| s.to_string());

                    let mut err = AIProviderError::new(message);
                    if let Some(s) = error_status {
                        err = err.with_type(s);
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
            let mut err = AIProviderError::new(&error.message);
            if let Some(s) = error.status {
                err = err.with_type(s);
            }
            return Err(err);
        }

        let candidates = gemini_response.candidates.unwrap_or_default();
        let candidate = candidates
            .into_iter()
            .next()
            .ok_or_else(|| AIProviderError::new("No response candidates"))?;

        let mut content = String::new();
        let mut tool_calls = Vec::new();
        let mut tool_call_index = 0;

        if let Some(candidate_content) = candidate.content {
            for part in candidate_content.parts {
                if let Some(text) = part.text {
                    content.push_str(&text);
                }
                if let Some(fc) = part.function_call {
                    tool_calls.push(ToolCall {
                        id: format!("call_{}", tool_call_index),
                        name: fc.name,
                        arguments: fc.args.to_string(),
                    });
                    tool_call_index += 1;
                }
            }
        }

        let finish_reason = if !tool_calls.is_empty() {
            FinishReason::ToolCalls
        } else {
            parse_finish_reason(candidate.finish_reason.as_deref())
        };

        Ok(ChatResponse {
            content: if content.is_empty() {
                None
            } else {
                Some(content)
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

        let (system_instruction, gemini_contents) = convert_messages(&messages);
        let gemini_tools: Vec<GeminiTool> = if tools.is_empty() {
            vec![]
        } else {
            vec![GeminiTool {
                function_declarations: tools.iter().map(convert_tool).collect(),
            }]
        };

        let request = GeminiRequest {
            contents: gemini_contents,
            system_instruction,
            tools: gemini_tools,
        };

        let url = format!(
            "{}{}:streamGenerateContent?alt=sse&key={}",
            GEMINI_API_URL,
            model.to_string(),
            self.api_key
        );

        println!("[Gemini] Sending request to streaming endpoint");
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

        println!("[Gemini] Response successful, setting up stream");

        let (tx, rx) = mpsc::channel(100);

        let mut stream = response.bytes_stream();
        println!("[Gemini] Spawning stream processing task");
        tokio::spawn(async move {
            use futures_util::StreamExt;

            println!("[Gemini] Stream processing task started");
            let mut buffer = String::new();
            let mut tool_call_index = 0;
            let mut pending_tool_calls: Vec<(String, String, String)> = Vec::new(); // (id, name, args)

            let mut chunk_count = 0;
            while let Some(chunk_result) = stream.next().await {
                chunk_count += 1;
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        println!(
                            "[Gemini] Received chunk #{}: {} bytes",
                            chunk_count,
                            chunk.len()
                        );
                        buffer.push_str(&chunk_str);

                        // Process complete SSE events
                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            for line in event.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if let Ok(response) =
                                        serde_json::from_str::<GeminiResponse>(data)
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
                                                            let id =
                                                                format!("call_{}", tool_call_index);
                                                            tool_call_index += 1;

                                                            println!(
                                                                "[Gemini] Function call: {} ({})",
                                                                fc.name, id
                                                            );

                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallStart {
                                                                    id: id.clone(),
                                                                    name: fc.name.clone(),
                                                                })
                                                                .await;

                                                            let args = fc.args.to_string();
                                                            let _ = tx
                                                                .send(StreamChunk::ToolCallDelta {
                                                                    id: id.clone(),
                                                                    arguments: args.clone(),
                                                                })
                                                                .await;

                                                            pending_tool_calls
                                                                .push((id, fc.name, args));
                                                        }
                                                    }
                                                }

                                                if let Some(reason) = candidate.finish_reason {
                                                    println!("[Gemini] Finish reason: {}", reason);
                                                    let finish_reason =
                                                        if !pending_tool_calls.is_empty() {
                                                            FinishReason::ToolCalls
                                                        } else {
                                                            parse_finish_reason(Some(&reason))
                                                        };
                                                    let _ = tx
                                                        .send(StreamChunk::Done { finish_reason })
                                                        .await;
                                                }
                                            }
                                        }

                                        if let Some(error) = response.error {
                                            println!("[Gemini] Stream error: {}", error.message);
                                            let _ =
                                                tx.send(StreamChunk::Error(error.message)).await;
                                            return;
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
