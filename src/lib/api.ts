import { invoke } from "@tauri-apps/api/core";
import { storage } from "./storage";
import type {
  ConnectionConfig,
  SavedConnection,
  TableInfo,
  ColumnInfo,
  QueryResult,
  AIModelInfo,
  ChatRequest,
  ChatResponse,
  UserStatus,
} from "./types";

export const api = {
  connect: (id: string, config: ConnectionConfig) => invoke<void>("connect", { id, config }),

  disconnect: (id: string) => invoke<void>("disconnect", { id }),

  testConnection: (config: ConnectionConfig) => invoke<void>("test_connection_handler", { config }),

  listTables: (connectionId: string) => invoke<TableInfo[]>("list_tables", { connectionId }),

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

  // MongoDB document operations
  insertDocument: (connectionId: string, collection: string, document: string) =>
    invoke<string>("insert_document", { connectionId, collection, document }),

  updateDocument: (connectionId: string, collection: string, filter: string, update: string) =>
    invoke<number>("update_document", {
      connectionId,
      collection,
      filter,
      update,
    }),

  deleteDocument: (connectionId: string, collection: string, filter: string) =>
    invoke<number>("delete_document", { connectionId, collection, filter }),

  // Storage operations - now using SQLite via storage module
  getSavedConnections: () => storage.getSavedConnections(),

  saveConnection: (connection: SavedConnection) => storage.saveConnection(connection),

  deleteSavedConnection: (id: string) => storage.deleteSavedConnection(id),

  // AI API
  aiGetModels: () => invoke<AIModelInfo[]>("ai_get_models"),

  aiValidateKey: (apiKey: string, model: string) =>
    invoke<boolean>("ai_validate_key", { apiKey, model }),

  aiChat: (request: ChatRequest) => invoke<ChatResponse>("ai_chat", { request }),

  aiChatStream: (request: ChatRequest) => invoke<void>("ai_chat_stream", { request }),

  aiFetchOpenRouterModels: (apiKey: string) =>
    invoke<AIModelInfo[]>("ai_fetch_openrouter_models", { apiKey }),

  aiFetchVercelModels: (apiKey: string) =>
    invoke<AIModelInfo[]>("ai_fetch_vercel_models", { apiKey }),

  // User status API (synced from auth session)
  setUserProStatus: (isPro: boolean) => invoke<void>("set_user_pro_status", { isPro }),

  getUserStatus: () => invoke<UserStatus>("get_user_status"),

  getMaxConnections: () => invoke<number>("get_max_connections"),

  isUserPro: () => invoke<boolean>("is_user_pro"),

  getConnectionCount: () => invoke<number>("get_connection_count"),

  getSavedConnectionCount: () => storage.getSavedConnectionCount(),
};
