pub mod gemini;
pub mod openai;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AIProviderType {
    #[default]
    OpenAI,
    Google,
}

impl fmt::Display for AIProviderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AIProviderType::OpenAI => write!(f, "OpenAI"),
            AIProviderType::Google => write!(f, "Google"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum AIModel {
    #[default]
    #[serde(rename = "gpt-5")]
    Gpt5,
    #[serde(rename = "gpt-5-mini")]
    Gpt5Mini,
    #[serde(rename = "gemini-3-flash-preview")]
    Gemini3Flash,
    #[serde(rename = "gemini-3-pro-preview")]
    Gemini3Pro,
}

impl AIModel {
    pub fn as_str(&self) -> &'static str {
        match self {
            AIModel::Gpt5 => "gpt-5",
            AIModel::Gpt5Mini => "gpt-5-mini",
            AIModel::Gemini3Flash => "gemini-3-flash-preview",
            AIModel::Gemini3Pro => "gemini-3-pro-preview",
        }
    }

    pub fn provider(&self) -> AIProviderType {
        match self {
            AIModel::Gpt5 | AIModel::Gpt5Mini => AIProviderType::OpenAI,
            AIModel::Gemini3Flash | AIModel::Gemini3Pro => AIProviderType::Google,
        }
    }

    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            AIModel::Gpt5 => "GPT-5",
            AIModel::Gpt5Mini => "GPT-5 Mini",
            AIModel::Gemini3Flash => "Gemini 3 Flash",
            AIModel::Gemini3Pro => "Gemini 3 Pro",
        }
    }
}

impl fmt::Display for AIModel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for AIModel {
    type Err = AIProviderError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "gpt-5" => Ok(AIModel::Gpt5),
            "gpt-5-mini" => Ok(AIModel::Gpt5Mini),
            "gemini-3-flash-preview" => Ok(AIModel::Gemini3Flash),
            "gemini-3-pro-preview" => Ok(AIModel::Gemini3Pro),
            _ => Err(AIProviderError::new(format!("Unknown model: {}", s))),
        }
    }
}

#[derive(Debug, Clone)]
pub struct AIProviderError {
    pub message: String,
    pub error_type: Option<String>,
    pub is_retryable: bool,
}

impl AIProviderError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            error_type: None,
            is_retryable: false,
        }
    }

    pub fn with_type(mut self, error_type: impl Into<String>) -> Self {
        self.error_type = Some(error_type.into());
        self
    }

    pub fn retryable(mut self) -> Self {
        self.is_retryable = true;
        self
    }
}

impl fmt::Display for AIProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)?;
        if let Some(ref error_type) = self.error_type {
            write!(f, " ({})", error_type)?;
        }
        Ok(())
    }
}

impl std::error::Error for AIProviderError {}

impl From<AIProviderError> for String {
    fn from(err: AIProviderError) -> String {
        err.to_string()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::System,
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::User,
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Assistant,
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn assistant_with_tool_calls(content: Option<String>, tool_calls: Vec<ToolCall>) -> Self {
        Self {
            role: ChatRole::Assistant,
            content,
            tool_calls: Some(tool_calls),
            tool_call_id: None,
        }
    }

    pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: ChatRole::Tool,
            content: Some(content.into()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: ToolParameters,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameters {
    #[serde(rename = "type")]
    pub param_type: String,
    pub properties: serde_json::Value,
    pub required: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ChatResponse {
    pub content: Option<String>,
    pub tool_calls: Vec<ToolCall>,
    pub finish_reason: FinishReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FinishReason {
    Stop,
    ToolCalls,
    Length,
    ContentFilter,
    Unknown,
}

#[derive(Debug, Clone)]
pub enum StreamChunk {
    Content(String),
    ToolCallStart { id: String, name: String },
    ToolCallDelta { id: String, arguments: String },
    Done { finish_reason: FinishReason },
    Error(String),
}

#[async_trait]
pub trait AIProvider: Send + Sync {
    #[allow(dead_code)]
    fn provider_type(&self) -> AIProviderType;

    async fn chat(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<ChatResponse, AIProviderError>;

    async fn chat_stream(
        &self,
        model: &AIModel,
        messages: Vec<ChatMessage>,
        tools: &[ToolDefinition],
    ) -> Result<tokio::sync::mpsc::Receiver<StreamChunk>, AIProviderError>;
}

pub fn create_ai_provider(
    provider_type: AIProviderType,
    api_key: String,
) -> Result<Box<dyn AIProvider>, AIProviderError> {
    match provider_type {
        AIProviderType::OpenAI => {
            let provider = openai::OpenAIProvider::new(api_key);
            Ok(Box::new(provider))
        }
        AIProviderType::Google => {
            let provider = gemini::GeminiProvider::new(api_key);
            Ok(Box::new(provider))
        }
    }
}

pub fn get_available_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: AIModel::Gpt5,
            name: "GPT-5".to_string(),
            provider: AIProviderType::OpenAI,
        },
        ModelInfo {
            id: AIModel::Gpt5Mini,
            name: "GPT-5 Mini".to_string(),
            provider: AIProviderType::OpenAI,
        },
        ModelInfo {
            id: AIModel::Gemini3Flash,
            name: "Gemini 3 Flash".to_string(),
            provider: AIProviderType::Google,
        },
        ModelInfo {
            id: AIModel::Gemini3Pro,
            name: "Gemini 3 Pro".to_string(),
            provider: AIProviderType::Google,
        },
    ]
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: AIModel,
    pub name: String,
    pub provider: AIProviderType,
}
