import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionConfig,
  SavedConnection,
  TableInfo,
  ColumnInfo,
  QueryResult,
  AIModelInfo,
  ChatRequest,
  ChatResponse,
} from "./types";

export const api = {
  connect: (id: string, config: ConnectionConfig) =>
    invoke<void>("connect", { id, config }),

  disconnect: (id: string) => invoke<void>("disconnect", { id }),

  testConnection: (config: ConnectionConfig) =>
    invoke<void>("test_connection_handler", { config }),

  listTables: (connectionId: string) =>
    invoke<TableInfo[]>("list_tables", { connectionId }),

  getTableColumns: (connectionId: string, schema: string, table: string) =>
    invoke<ColumnInfo[]>("get_table_columns", { connectionId, schema, table }),

  getTableData: (
    connectionId: string,
    schema: string,
    table: string,
    limit: number,
    offset: number,
  ) =>
    invoke<QueryResult>("get_table_data", {
      connectionId,
      schema,
      table,
      limit,
      offset,
    }),

  executeQuery: (connectionId: string, query: string) =>
    invoke<QueryResult>("execute_query", { connectionId, query }),

  getTableCount: (connectionId: string, schema: string, table: string) =>
    invoke<number>("get_table_count", { connectionId, schema, table }),

  getSavedConnections: () =>
    invoke<{ connections: SavedConnection[] }>("get_saved_connections"),

  saveConnection: (connection: SavedConnection) =>
    invoke<void>("save_connection", { connection }),

  deleteSavedConnection: (id: string) =>
    invoke<void>("delete_saved_connection", { id }),

  // AI API
  aiGetModels: () => invoke<AIModelInfo[]>("ai_get_models"),

  aiValidateKey: (apiKey: string, model: string) =>
    invoke<boolean>("ai_validate_key", { apiKey, model }),

  aiChat: (request: ChatRequest) =>
    invoke<ChatResponse>("ai_chat", { request }),

  aiChatStream: (request: ChatRequest) =>
    invoke<void>("ai_chat_stream", { request }),
};
