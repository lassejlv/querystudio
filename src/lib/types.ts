export type DatabaseType = "postgres" | "mysql" | "sqlite" | "redis" | "mongodb";

export type ConnectionParams =
  | { connection_string: string }
  | {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };

export type ConnectionConfig = {
  db_type: DatabaseType;
} & ConnectionParams;

export type SavedConnectionConfig =
  | { connection_string: string }
  | {
      host: string;
      port: number;
      database: string;
      username: string;
    };

export interface SavedConnection {
  id: string;
  name: string;
  db_type: DatabaseType;
  config: SavedConnectionConfig;
}

export interface Connection {
  id: string;
  name: string;
  db_type: DatabaseType;
  config: ConnectionConfig;
}

export interface TableInfo {
  schema: string;
  name: string;
  row_count: number;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  has_default: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

// ============================================================================
// AI Types
// ============================================================================

export type AIProviderType = "openai" | "anthropic" | "google" | "openrouter" | "vercel";

export type AIModelId = string;

export interface AIModelInfo {
  id: AIModelId;
  name: string;
  provider: AIProviderType;
}

export interface AgentMessage {
  id: string;
  role: string;
  content: string;
  tool_calls?: AgentToolCall[];
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

export interface ChatRequest {
  connection_id: string;
  session_id: string;
  message: string;
  model: AIModelId;
  api_key: string;
  db_type: DatabaseType;
  history?: AgentMessage[];
}

export interface ChatResponse {
  content: string;
  session_id: string;
}

export type AgentEventType =
  | { type: "Content"; data: string }
  | { type: "ToolCallStart"; data: { id: string; name: string } }
  | { type: "ToolCallDelta"; data: { id: string; arguments: string } }
  | { type: "ToolResult"; data: { id: string; name: string; result: string } }
  | { type: "Done"; data: { content: string } }
  | { type: "Error"; data: string };

// Frontend-friendly message type
export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  isLoading?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: AIModelId;
  connectionId: string;
  dbType: DatabaseType;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// User Status Types
// ============================================================================

export interface UserStatus {
  is_pro: boolean;
  max_connections: number;
}
