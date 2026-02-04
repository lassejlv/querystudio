pub mod gemini;
pub mod openai;
pub mod openrouter;
pub mod vercel;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AIProviderType {
    #[default]
    OpenAI,
    Google,
    OpenRouter,
    Vercel,
}

impl fmt::Display for AIProviderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AIProviderType::OpenAI => write!(f, "OpenAI"),
            AIProviderType::Google => write!(f, "Google"),
            AIProviderType::OpenRouter => write!(f, "OpenRouter"),
            AIProviderType::Vercel => write!(f, "Vercel"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum AIModel {
    #[default]
    Gpt5,
    Gpt5Mini,
    Gemini3Flash,
    Gemini3Pro,
    /// Dynamic OpenRouter model — holds the raw model slug (e.g. "anthropic/claude-sonnet-4")
    OpenRouter(String),
    /// Dynamic Vercel AI Gateway model — holds the raw model slug (e.g. "anthropic/claude-sonnet-4.5")
    Vercel(String),
}

impl AIModel {
    pub fn as_str(&self) -> String {
        match self {
            AIModel::Gpt5 => "gpt-5".to_string(),
            AIModel::Gpt5Mini => "gpt-5-mini".to_string(),
            AIModel::Gemini3Flash => "gemini-3-flash-preview".to_string(),
            AIModel::Gemini3Pro => "gemini-3-pro-preview".to_string(),
            AIModel::OpenRouter(slug) => format!("openrouter/{}", slug),
            AIModel::Vercel(slug) => format!("vercel/{}", slug),
        }
    }

    pub fn provider(&self) -> AIProviderType {
        match self {
            AIModel::Gpt5 | AIModel::Gpt5Mini => AIProviderType::OpenAI,
            AIModel::Gemini3Flash | AIModel::Gemini3Pro => AIProviderType::Google,
            AIModel::OpenRouter(_) => AIProviderType::OpenRouter,
            AIModel::Vercel(_) => AIProviderType::Vercel,
        }
    }

    /// Returns the raw model slug sent to the provider API.
    /// For gateway providers, this strips the prefix (e.g. "openrouter/" or "vercel/").
    pub fn api_model_id(&self) -> String {
        match self {
            AIModel::OpenRouter(slug) | AIModel::Vercel(slug) => slug.clone(),
            other => other.as_str(),
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
            s if s.starts_with("openrouter/") => {
                let slug = s.strip_prefix("openrouter/").unwrap().to_string();
                Ok(AIModel::OpenRouter(slug))
            }
            s if s.starts_with("vercel/") => {
                let slug = s.strip_prefix("vercel/").unwrap().to_string();
                Ok(AIModel::Vercel(slug))
            }
            _ => Err(AIProviderError::new(format!("Unknown model: {}", s))),
        }
    }
}

impl Serialize for AIModel {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.as_str())
    }
}

impl<'de> Deserialize<'de> for AIModel {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        s.parse().map_err(serde::de::Error::custom)
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
        AIProviderType::OpenRouter => {
            let provider = openrouter::OpenRouterProvider::new(api_key);
            Ok(Box::new(provider))
        }
        AIProviderType::Vercel => {
            let provider = vercel::VercelProvider::new(api_key);
            Ok(Box::new(provider))
        }
    }
}

pub fn get_available_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "gpt-5".to_string(),
            name: "GPT-5".to_string(),
            provider: AIProviderType::OpenAI,
        },
        ModelInfo {
            id: "gpt-5-mini".to_string(),
            name: "GPT-5 Mini".to_string(),
            provider: AIProviderType::OpenAI,
        },
        ModelInfo {
            id: "gemini-3-flash-preview".to_string(),
            name: "Gemini 3 Flash".to_string(),
            provider: AIProviderType::Google,
        },
        ModelInfo {
            id: "gemini-3-pro-preview".to_string(),
            name: "Gemini 3 Pro".to_string(),
            provider: AIProviderType::Google,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: AIProviderType,
}
