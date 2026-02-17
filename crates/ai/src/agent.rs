use crate::providers::{
    create_ai_provider, AIModel, AIProvider, AIProviderError, ChatMessage, FinishReason,
    StreamChunk, ToolCall,
};
use crate::tools::{
    get_system_prompt, get_tool_definitions, validate_select_query, ColumnSummary,
    ExecuteSelectQueryArgs, GetTableColumnsArgs, GetTableSampleArgs, QueryDataResult, TableSummary,
    ToolError, ToolResult,
};
use crate::types::{DatabaseOperations, DatabaseType};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<AgentToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum AgentEvent {
    Content(String),
    ToolCallStart {
        id: String,
        name: String,
    },
    ToolCallDelta {
        id: String,
        arguments: String,
    },
    ToolResult {
        id: String,
        name: String,
        result: String,
    },
    Done {
        content: String,
    },
    Error(String),
}

pub struct Agent {
    provider: Box<dyn AIProvider>,
    db: Arc<dyn DatabaseOperations>,
    connection_id: String,
    db_type: DatabaseType,
    model: AIModel,
    messages: Vec<ChatMessage>,
}

impl Agent {
    pub fn new(
        api_key: String,
        db: Arc<dyn DatabaseOperations>,
        connection_id: String,
        db_type: DatabaseType,
        model: AIModel,
    ) -> Result<Self, AIProviderError> {
        let provider = create_ai_provider(model.provider(), api_key)?;

        let system_prompt = get_system_prompt(db_type);
        let messages = vec![ChatMessage::system(system_prompt)];

        Ok(Self {
            provider,
            db,
            connection_id,
            db_type,
            model,
            messages,
        })
    }

    #[allow(dead_code)]
    pub fn set_model(&mut self, model: AIModel, api_key: String) -> Result<(), AIProviderError> {
        let old_provider = self.model.provider();
        let new_provider = model.provider();

        if old_provider != new_provider {
            self.provider = create_ai_provider(new_provider, api_key)?;
        }

        self.model = model;
        Ok(())
    }

    pub fn clear_history(&mut self) {
        let system_prompt = get_system_prompt(self.db_type);
        self.messages = vec![ChatMessage::system(system_prompt)];
    }

    pub fn load_messages(&mut self, messages: Vec<AgentMessage>) {
        self.clear_history();
        println!("[Agent] Loading {} history messages", messages.len());

        for msg in messages {
            println!(
                "[Agent] Processing history message: role={}, has_tool_calls={}",
                msg.role,
                msg.tool_calls.is_some()
            );
            match msg.role.as_str() {
                "user" => {
                    self.messages.push(ChatMessage::user(msg.content));
                }
                "assistant" => {
                    if let Some(ref tool_calls) = msg.tool_calls {
                        let calls: Vec<ToolCall> = tool_calls
                            .iter()
                            .map(|tc| ToolCall {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                arguments: tc.arguments.clone(),
                            })
                            .collect();
                        self.messages.push(ChatMessage::assistant_with_tool_calls(
                            if msg.content.is_empty() {
                                None
                            } else {
                                Some(msg.content.clone())
                            },
                            calls,
                        ));

                        for tc in tool_calls {
                            if let Some(ref result) = tc.result {
                                println!("[Agent] Adding tool result for call_id: {}", tc.id);
                                self.messages.push(ChatMessage::tool_result(&tc.id, result));
                            } else {
                                println!("[Agent] WARNING: Tool call {} has no result!", tc.id);
                            }
                        }
                    } else {
                        self.messages.push(ChatMessage::assistant(msg.content));
                    }
                }
                "tool" => {}
                _ => {
                    println!("[Agent] Unknown message role: {}", msg.role);
                }
            }
        }
        println!(
            "[Agent] After loading history, total messages: {}",
            self.messages.len()
        );
    }

    pub async fn chat_stream(
        mut self,
        user_message: String,
    ) -> Result<mpsc::Receiver<AgentEvent>, AIProviderError> {
        let total_start = Instant::now();
        println!("[Agent] chat_stream called with message: {}", user_message);
        let (tx, rx) = mpsc::channel(100);

        self.messages.push(ChatMessage::user(user_message.clone()));
        println!(
            "[Agent] Added user message to history, total messages: {} (elapsed: {:?})",
            self.messages.len(),
            total_start.elapsed()
        );

        let tools = get_tool_definitions(self.db_type);
        println!(
            "[Agent] Got {} tool definitions for {:?} (elapsed: {:?})",
            tools.len(),
            self.db_type,
            total_start.elapsed()
        );

        println!(
            "[Agent] Spawning background task for streaming... (elapsed: {:?})",
            total_start.elapsed()
        );
        tokio::spawn(async move {
            let task_start = Instant::now();
            println!("[Agent] Background task started");
            if let Err(e) = self.stream_with_tools(tx.clone(), tools).await {
                println!(
                    "[Agent] stream_with_tools error: {} (elapsed: {:?})",
                    e,
                    task_start.elapsed()
                );
                let _ = tx.send(AgentEvent::Error(e.to_string())).await;
            }
            println!(
                "[Agent] Background task finished (total task time: {:?})",
                task_start.elapsed()
            );
        });

        println!(
            "[Agent] Returning receiver (elapsed: {:?})",
            total_start.elapsed()
        );
        Ok(rx)
    }

    async fn stream_with_tools(
        &mut self,
        tx: mpsc::Sender<AgentEvent>,
        tools: Vec<crate::providers::ToolDefinition>,
    ) -> Result<(), AIProviderError> {
        let stream_start = Instant::now();
        println!("[Agent] stream_with_tools called");
        let mut continue_loop = true;
        let mut full_content = String::new();
        let mut loop_iteration = 0;

        while continue_loop {
            loop_iteration += 1;
            let loop_start = Instant::now();
            println!(
                "[Agent] Loop iteration #{} - Calling provider.chat_stream with model: {:?} (total elapsed: {:?})",
                loop_iteration,
                self.model,
                stream_start.elapsed()
            );
            let api_call_start = Instant::now();
            let mut stream = self
                .provider
                .chat_stream(&self.model, self.messages.clone(), &tools)
                .await?;
            println!(
                "[Agent] Got stream from provider (API call took: {:?}, total elapsed: {:?})",
                api_call_start.elapsed(),
                stream_start.elapsed()
            );

            let mut current_content = String::new();
            let mut tool_calls: Vec<ToolCall> = Vec::new();
            let mut tool_call_map: std::collections::HashMap<String, (String, String)> =
                std::collections::HashMap::new();

            println!("[Agent] Starting to receive chunks from stream");
            let mut chunk_count = 0;
            while let Some(chunk) = stream.recv().await {
                chunk_count += 1;
                println!(
                    "[Agent] Received chunk #{}: {:?}",
                    chunk_count,
                    std::mem::discriminant(&chunk)
                );
                match chunk {
                    StreamChunk::Content(content) => {
                        println!("[Agent] Content chunk: {} chars", content.len());
                        current_content.push_str(&content);
                        full_content.push_str(&content);
                        let _ = tx.send(AgentEvent::Content(content)).await;
                    }
                    StreamChunk::ToolCallStart { id, name } => {
                        tool_call_map.insert(id.clone(), (name.clone(), String::new()));
                        let _ = tx
                            .send(AgentEvent::ToolCallStart {
                                id: id.clone(),
                                name,
                            })
                            .await;
                    }
                    StreamChunk::ToolCallDelta { id, arguments } => {
                        if let Some((_, args)) = tool_call_map.get_mut(&id) {
                            args.push_str(&arguments);
                        }
                        let _ = tx.send(AgentEvent::ToolCallDelta { id, arguments }).await;
                    }
                    StreamChunk::Done { finish_reason } => {
                        println!(
                            "[Agent] Received Done with finish_reason: {:?}",
                            finish_reason
                        );
                        for (id, (name, arguments)) in tool_call_map.drain() {
                            tool_calls.push(ToolCall {
                                id,
                                name,
                                arguments,
                            });
                        }
                        println!("[Agent] Tool calls collected: {}", tool_calls.len());

                        match finish_reason {
                            FinishReason::Stop => {
                                println!("[Agent] FinishReason::Stop - ending loop");
                                continue_loop = false;
                                self.messages.push(ChatMessage::assistant(&full_content));
                                let _ = tx
                                    .send(AgentEvent::Done {
                                        content: full_content.clone(),
                                    })
                                    .await;
                            }
                            FinishReason::ToolCalls => {
                                println!(
                                    "[Agent] FinishReason::ToolCalls - executing {} tools (loop iteration took: {:?})",
                                    tool_calls.len(),
                                    loop_start.elapsed()
                                );
                                self.messages.push(ChatMessage::assistant_with_tool_calls(
                                    if current_content.is_empty() {
                                        None
                                    } else {
                                        Some(current_content.clone())
                                    },
                                    tool_calls.clone(),
                                ));

                                for tool_call in &tool_calls {
                                    let tool_start = Instant::now();
                                    println!(
                                        "[Agent] Executing tool: {} (total elapsed: {:?})",
                                        tool_call.name,
                                        stream_start.elapsed()
                                    );
                                    let result = self.execute_tool(tool_call).await;
                                    println!(
                                        "[Agent] Tool {} completed in {:?}",
                                        tool_call.name,
                                        tool_start.elapsed()
                                    );
                                    let result_str = serde_json::to_string_pretty(&result)
                                        .unwrap_or_else(|_| "Error serializing result".to_string());

                                    let _ = tx
                                        .send(AgentEvent::ToolResult {
                                            id: tool_call.id.clone(),
                                            name: tool_call.name.clone(),
                                            result: result_str.clone(),
                                        })
                                        .await;

                                    self.messages
                                        .push(ChatMessage::tool_result(&tool_call.id, &result_str));
                                }

                                println!(
                                    "[Agent] Tool calls executed, breaking inner loop to make new API call (loop iteration #{} took: {:?})",
                                    loop_iteration,
                                    loop_start.elapsed()
                                );
                                println!(
                                    "[Agent] Message history now has {} messages (total elapsed: {:?})",
                                    self.messages.len(),
                                    stream_start.elapsed()
                                );
                                tool_calls.clear();
                                current_content.clear();
                                break;
                            }
                            _ => {
                                println!("[Agent] Unknown finish reason - ending loop");
                                continue_loop = false;
                                let _ = tx
                                    .send(AgentEvent::Done {
                                        content: full_content.clone(),
                                    })
                                    .await;
                            }
                        }
                    }
                    StreamChunk::Error(error) => {
                        let _ = tx.send(AgentEvent::Error(error)).await;
                        continue_loop = false;
                    }
                }
            }
        }

        println!(
            "[Agent] stream_with_tools completed (total time: {:?})",
            stream_start.elapsed()
        );
        Ok(())
    }

    async fn execute_tool(&self, tool_call: &ToolCall) -> ToolResult {
        let tool_start = Instant::now();
        let result = match tool_call.name.as_str() {
            "list_tables" => self.execute_list_tables().await,
            "get_table_columns" => {
                match serde_json::from_str::<GetTableColumnsArgs>(&tool_call.arguments) {
                    Ok(args) => self.execute_get_table_columns(args).await,
                    Err(e) => ToolResult::Error(ToolError {
                        error: format!("Invalid arguments: {}", e),
                    }),
                }
            }
            "execute_select_query" => {
                match serde_json::from_str::<ExecuteSelectQueryArgs>(&tool_call.arguments) {
                    Ok(args) => self.execute_select_query(args).await,
                    Err(e) => ToolResult::Error(ToolError {
                        error: format!("Invalid arguments: {}", e),
                    }),
                }
            }
            "get_table_sample" => {
                match serde_json::from_str::<GetTableSampleArgs>(&tool_call.arguments) {
                    Ok(args) => self.execute_get_table_sample(args).await,
                    Err(e) => ToolResult::Error(ToolError {
                        error: format!("Invalid arguments: {}", e),
                    }),
                }
            }
            _ => ToolResult::Error(ToolError {
                error: format!(
                    "Unknown tool: {}. Available tools: list_tables, get_table_columns, execute_select_query, get_table_sample. Use one of these names exactly.",
                    tool_call.name
                ),
            }),
        };
        println!(
            "[Agent] execute_tool '{}' took {:?}",
            tool_call.name,
            tool_start.elapsed()
        );
        result
    }

    async fn execute_list_tables(&self) -> ToolResult {
        match self.db.list_tables(&self.connection_id).await {
            Ok(tables) => ToolResult::Tables(
                tables
                    .into_iter()
                    .map(|t| TableSummary {
                        schema: t.schema,
                        name: t.name,
                        row_count: t.row_count,
                    })
                    .collect(),
            ),
            Err(e) => ToolResult::Error(ToolError { error: e }),
        }
    }

    async fn execute_get_table_columns(&self, args: GetTableColumnsArgs) -> ToolResult {
        match self
            .db
            .get_table_columns(&self.connection_id, &args.schema, &args.table)
            .await
        {
            Ok(columns) => ToolResult::Columns(
                columns
                    .into_iter()
                    .map(|c| ColumnSummary {
                        name: c.name,
                        data_type: c.data_type,
                        is_nullable: c.is_nullable,
                        is_primary_key: c.is_primary_key,
                        has_default: c.has_default,
                    })
                    .collect(),
            ),
            Err(e) => ToolResult::Error(ToolError { error: e }),
        }
    }

    async fn execute_select_query(&self, args: ExecuteSelectQueryArgs) -> ToolResult {
        if let Err(e) = validate_select_query(&args.query) {
            return ToolResult::Error(ToolError { error: e });
        }

        match self
            .db
            .execute_query(&self.connection_id, &args.query)
            .await
        {
            Ok(result) => ToolResult::QueryData(QueryDataResult::from(result)),
            Err(e) => ToolResult::Error(ToolError { error: e }),
        }
    }

    async fn execute_get_table_sample(&self, args: GetTableSampleArgs) -> ToolResult {
        let limit = args.limit.max(1).min(100);

        match self
            .db
            .get_table_data(&self.connection_id, &args.schema, &args.table, limit, 0)
            .await
        {
            Ok(result) => ToolResult::QueryData(QueryDataResult::from(result)),
            Err(e) => ToolResult::Error(ToolError { error: e }),
        }
    }

    pub async fn chat(&mut self, user_message: String) -> Result<String, AIProviderError> {
        self.messages.push(ChatMessage::user(user_message));

        let tools = get_tool_definitions(self.db_type);

        let mut continue_loop = true;
        let mut full_content = String::new();

        while continue_loop {
            let response = self
                .provider
                .chat(&self.model, self.messages.clone(), &tools)
                .await?;

            if let Some(content) = &response.content {
                full_content.push_str(content);
            }

            match response.finish_reason {
                FinishReason::Stop => {
                    continue_loop = false;
                    self.messages.push(ChatMessage::assistant(&full_content));
                }
                FinishReason::ToolCalls => {
                    self.messages.push(ChatMessage::assistant_with_tool_calls(
                        response.content.clone(),
                        response.tool_calls.clone(),
                    ));

                    for tool_call in &response.tool_calls {
                        let result = self.execute_tool(tool_call).await;
                        let result_str = serde_json::to_string_pretty(&result)
                            .unwrap_or_else(|_| "Error serializing result".to_string());

                        self.messages
                            .push(ChatMessage::tool_result(&tool_call.id, &result_str));
                    }
                }
                _ => {
                    continue_loop = false;
                    if !full_content.is_empty() {
                        self.messages.push(ChatMessage::assistant(&full_content));
                    }
                }
            }
        }

        Ok(full_content)
    }
}
