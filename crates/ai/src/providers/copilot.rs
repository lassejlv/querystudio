use super::{
    AIModel, AIProvider, AIProviderError, AIProviderType, ChatMessage, ChatResponse, ChatRole,
    FinishReason, ModelInfo, StreamChunk, ToolCall, ToolDefinition,
};
use async_trait::async_trait;
use copilot_sdk::{Client, CopilotError, SessionConfig, SessionEventData, Tool};
use std::collections::HashSet;
use std::env;
use tokio::sync::mpsc;

pub struct CopilotProvider {
    _api_key: String,
}

impl CopilotProvider {
    pub fn new(api_key: String) -> Self {
        Self { _api_key: api_key }
    }

    fn create_client() -> Result<Client, AIProviderError> {
        ensure_copilot_path();

        Client::builder()
            .use_stdio(true)
            .build()
            .map_err(map_copilot_error)
    }

    async fn ensure_authenticated(client: &Client) -> Result<(), AIProviderError> {
        let auth = client.get_auth_status().await.map_err(map_copilot_error)?;
        if !auth.is_authenticated {
            return Err(AIProviderError::new(
                "GitHub Copilot CLI is not authenticated. Run `copilot login`.",
            )
            .with_type("unauthorized"));
        }
        Ok(())
    }

    async fn execute_chat(
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
        stream_tx: Option<mpsc::Sender<StreamChunk>>,
    ) -> Result<ChatResponse, AIProviderError> {
        let client = Self::create_client()?;
        client.start().await.map_err(map_copilot_error)?;

        let result = async {
            Self::ensure_authenticated(&client).await?;

            let session = client
                .create_session(SessionConfig {
                    model: Some(model.api_model_id()),
                    tools: tools.iter().map(convert_tool).collect(),
                    streaming: true,
                    ..Default::default()
                })
                .await
                .map_err(map_copilot_error)?;

            let mut events = session.subscribe();
            session
                .send(build_prompt(&messages, tools))
                .await
                .map_err(map_copilot_error)?;

            let mut content = String::new();
            let mut tool_call_ids = HashSet::new();
            let mut tool_calls = Vec::new();

            loop {
                let event = events.recv().await.map_err(|error| {
                    AIProviderError::new(format!("Copilot event stream error: {}", error))
                })?;

                match event.data {
                    SessionEventData::AssistantMessage(message) => {
                        let has_tool_requests =
                            message.tool_requests.as_ref().is_some_and(|r| !r.is_empty());

                        if !has_tool_requests && !message.content.is_empty() {
                            content.push_str(&message.content);
                            if let Some(tx) = &stream_tx {
                                let _ = tx.send(StreamChunk::Content(message.content)).await;
                            }
                        }

                        if let Some(requests) = message.tool_requests {
                            for request in requests {
                                if tool_call_ids.contains(&request.tool_call_id) {
                                    continue;
                                }
                                tool_call_ids.insert(request.tool_call_id.clone());

                                let arguments_value =
                                    request.arguments.unwrap_or_else(|| serde_json::json!({}));
                                let arguments = serde_json::to_string(&arguments_value)
                                    .unwrap_or_else(|_| "{}".to_string());

                                tool_calls.push(ToolCall {
                                    id: request.tool_call_id.clone(),
                                    name: request.name.clone(),
                                    arguments: arguments.clone(),
                                });

                                if let Some(tx) = &stream_tx {
                                    let _ = tx
                                        .send(StreamChunk::ToolCallStart {
                                            id: request.tool_call_id.clone(),
                                            name: request.name.clone(),
                                        })
                                        .await;
                                    let _ = tx
                                        .send(StreamChunk::ToolCallDelta {
                                            id: request.tool_call_id,
                                            arguments,
                                        })
                                        .await;
                                }
                            }
                        }
                    }
                    SessionEventData::SessionError(error) => {
                        return Err(AIProviderError::new(error.message).with_type(error.error_type));
                    }
                    SessionEventData::SessionIdle(_) => {
                        break;
                    }
                    _ => {}
                }
            }

            let finish_reason = if tool_calls.is_empty() {
                FinishReason::Stop
            } else {
                FinishReason::ToolCalls
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
        .await;

        let _ = client.stop().await;
        result
    }
}

fn ensure_copilot_path() {
    #[cfg(target_os = "macos")]
    {
        let current_path = env::var("PATH").unwrap_or_default();
        let path_contains = |p: &str| current_path.split(':').any(|entry| entry == p);

        let mut path_entries: Vec<String> = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
        ]
        .into_iter()
        .filter(|path| !path_contains(path))
        .map(str::to_string)
        .collect();

        if !current_path.is_empty() {
            path_entries.push(current_path);
        }

        for path in ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
            if !path_entries.iter().any(|entry| entry == path) {
                path_entries.push(path.to_string());
            }
        }

        if !path_entries.is_empty() {
            env::set_var("PATH", path_entries.join(":"));
        }
    }
}

fn build_prompt(messages: &[ChatMessage], tools: &[ToolDefinition]) -> String {
    let mut system_sections = Vec::new();
    let mut transcript_lines = Vec::new();

    for message in messages {
        match message.role {
            ChatRole::System => {
                if let Some(content) = message.content.as_deref().filter(|c| !c.is_empty()) {
                    system_sections.push(content.to_string());
                }
            }
            ChatRole::User => {
                if let Some(content) = message.content.as_deref().filter(|c| !c.is_empty()) {
                    transcript_lines.push(format!("User: {}", content));
                }
            }
            ChatRole::Assistant => {
                if let Some(content) = message.content.as_deref().filter(|c| !c.is_empty()) {
                    transcript_lines.push(format!("Assistant: {}", content));
                }

                if let Some(tool_calls) = &message.tool_calls {
                    for tool_call in tool_calls {
                        transcript_lines.push(format!(
                            "Assistant tool call [{}]: {} {}",
                            tool_call.id, tool_call.name, tool_call.arguments
                        ));
                    }
                }
            }
            ChatRole::Tool => {
                let tool_call_id = message.tool_call_id.as_deref().unwrap_or("unknown");
                let content = message.content.as_deref().unwrap_or("");
                transcript_lines.push(format!("Tool result [{}]: {}", tool_call_id, content));
            }
        }
    }

    let mut prompt_sections = Vec::new();

    if !system_sections.is_empty() {
        prompt_sections.push(format!(
            "System instructions:\n{}",
            system_sections.join("\n\n")
        ));
    }

    if !transcript_lines.is_empty() {
        prompt_sections.push(format!(
            "Conversation transcript:\n{}",
            transcript_lines.join("\n")
        ));
    }

    if !tools.is_empty() {
        let tool_lines = tools
            .iter()
            .map(|tool| format!("- {}: {}", tool.name, tool.description))
            .collect::<Vec<_>>()
            .join("\n");

        prompt_sections.push(format!(
            "Available tools (ONLY these exact names are valid):\n{}\n\nDo not invent or call any other tool names. If none of these tools fit, respond normally without tool calls.",
            tool_lines
        ));
    }

    prompt_sections.push(
        "Continue the conversation as the assistant. If tool usage is needed, use the available tools."
            .to_string(),
    );

    prompt_sections.join("\n\n")
}

fn convert_tool(tool: &ToolDefinition) -> Tool {
    Tool::new(tool.name.clone())
        .description(tool.description.clone())
        .schema(serde_json::json!({
            "type": tool.parameters.param_type,
            "properties": tool.parameters.properties,
            "required": tool.parameters.required,
        }))
}

fn map_copilot_error(error: CopilotError) -> AIProviderError {
    match &error {
        CopilotError::InvalidConfig(message)
            if message.contains("Could not find Copilot CLI executable") =>
        {
            AIProviderError::new(
                "GitHub Copilot CLI is not installed or not in PATH. Install it and run `copilot auth login`.",
            )
            .with_type("cli_not_found")
        }
        CopilotError::ConnectionClosed
        | CopilotError::Transport(_)
        | CopilotError::Timeout(_)
        | CopilotError::ProcessExit(_) => AIProviderError::new(error.to_string()).retryable(),
        _ => AIProviderError::new(error.to_string()),
    }
}

#[async_trait]
impl AIProvider for CopilotProvider {
    fn provider_type(&self) -> AIProviderType {
        AIProviderType::Copilot
    }

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError> {
        Self::execute_chat(model, messages, tools, None).await
    }

    async fn chat_stream(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<mpsc::Receiver<StreamChunk>, AIProviderError> {
        let (tx, rx) = mpsc::channel(100);
        let model = model.clone();
        let tools = tools.to_vec();

        tokio::spawn(async move {
            match CopilotProvider::execute_chat(&model, messages, &tools, Some(tx.clone())).await {
                Ok(response) => {
                    let _ = tx
                        .send(StreamChunk::Done {
                            finish_reason: response.finish_reason,
                        })
                        .await;
                }
                Err(error) => {
                    let _ = tx.send(StreamChunk::Error(error.to_string())).await;
                }
            }
        });

        Ok(rx)
    }
}

pub async fn fetch_models() -> Result<Vec<ModelInfo>, AIProviderError> {
    let client = CopilotProvider::create_client()?;
    client.start().await.map_err(map_copilot_error)?;

    let result = async {
        CopilotProvider::ensure_authenticated(&client).await?;

        let mut models: Vec<ModelInfo> = client
            .list_models()
            .await
            .map_err(map_copilot_error)?
            .into_iter()
            .map(|model| ModelInfo {
                id: format!("copilot/{}", model.id),
                name: model.name,
                provider: AIProviderType::Copilot,
                logo_provider: Some("copilot".to_string()),
            })
            .collect();

        models.sort_by(|a, b| a.name.cmp(&b.name));
        models.dedup_by(|a, b| a.id == b.id);

        Ok(models)
    }
    .await;

    let _ = client.stop().await;
    result
}
