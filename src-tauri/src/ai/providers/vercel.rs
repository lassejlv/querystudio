use super::openai::{
    convert_message, convert_tool, parse_finish_reason, OpenAIMessage, OpenAIRequest,
    OpenAIResponse, OpenAIStreamResponse, OpenAITool,
};
use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, FinishReason,
    ModelInfo, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use tokio::sync::mpsc;

const VERCEL_API_URL: &str = "https://ai-gateway.vercel.sh/v1/chat/completions";
const VERCEL_MODELS_URL: &str = "https://ai-gateway.vercel.sh/v1/models";

pub struct VercelProvider {
    client: Client,
    api_key: String,
}

impl VercelProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

#[async_trait]
impl AIProvider for VercelProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::Vercel
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
            model: model.api_model_id(),
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
            .post(VERCEL_API_URL)
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
        let openai_messages: Vec<OpenAIMessage> = messages.iter().map(convert_message).collect();
        let openai_tools: Vec<OpenAITool> = tools.iter().map(convert_tool).collect();

        let request = OpenAIRequest {
            model: model.api_model_id(),
            messages: openai_messages,
            tools: openai_tools,
            tool_choice: if tools.is_empty() {
                None
            } else {
                Some("auto".to_string())
            },
            stream: Some(true),
        };

        let response = self
            .client
            .post(VERCEL_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AIProviderError::new(format!("Request failed: {}", e)).retryable())?;

        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
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

        let (tx, rx) = mpsc::channel(100);

        let mut stream = response.bytes_stream();
        tokio::spawn(async move {
            use futures_util::StreamExt;

            let mut buffer = String::new();
            let mut current_tool_calls: std::collections::HashMap<usize, (String, String, String)> =
                std::collections::HashMap::new();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        let chunk_str = String::from_utf8_lossy(&chunk);
                        buffer.push_str(&chunk_str);

                        while let Some(pos) = buffer.find("\n\n") {
                            let event = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            for line in event.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
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
                                                let _ = tx
                                                    .send(StreamChunk::Done {
                                                        finish_reason: parse_finish_reason(Some(
                                                            &reason,
                                                        )),
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
                        let _ = tx.send(StreamChunk::Error(e.to_string())).await;
                        return;
                    }
                }
            }
        });

        Ok(rx)
    }
}

// ============================================================================
// Model Fetching
// ============================================================================

#[derive(Debug, Deserialize)]
struct VercelModelsResponse {
    data: Vec<VercelModelEntry>,
}

#[derive(Debug, Deserialize)]
struct VercelModelEntry {
    id: String,
    #[allow(dead_code)]
    owned_by: Option<String>,
}

/// Fetches available models from the Vercel AI Gateway.
/// Returns them as `ModelInfo` with the `vercel/` prefix on the id.
pub async fn fetch_models(api_key: &str) -> Result<Vec<ModelInfo>, AIProviderError> {
    let client = Client::new();
    let response = client
        .get(VERCEL_MODELS_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| AIProviderError::new(format!("Failed to fetch models: {}", e)))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AIProviderError::new(format!(
            "Failed to fetch models ({}): {}",
            status, body
        )));
    }

    let models_response: VercelModelsResponse = response
        .json()
        .await
        .map_err(|e| AIProviderError::new(format!("Failed to parse models response: {}", e)))?;

    let models = models_response
        .data
        .into_iter()
        .map(|m| ModelInfo {
            id: format!("vercel/{}", m.id),
            name: m.id.clone(),
            provider: AIProviderType::Vercel,
        })
        .collect();

    Ok(models)
}
