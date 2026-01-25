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
  LicenseStatus,
  DeviceInfo,
  ActivateResponse,
  VerifyResponse,
  CheckResponse,
  DeactivateResponse,
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

  // Storage operations - now using SQLite via storage module
  getSavedConnections: () => storage.getSavedConnections(),

  saveConnection: (connection: SavedConnection) =>
    storage.saveConnection(connection),

  deleteSavedConnection: (id: string) => storage.deleteSavedConnection(id),

  // AI API
  aiGetModels: () => invoke<AIModelInfo[]>("ai_get_models"),

  aiValidateKey: (apiKey: string, model: string) =>
    invoke<boolean>("ai_validate_key", { apiKey, model }),

  aiChat: (request: ChatRequest) =>
    invoke<ChatResponse>("ai_chat", { request }),

  aiChatStream: (request: ChatRequest) =>
    invoke<void>("ai_chat_stream", { request }),

  // License API
  licenseActivate: (licenseKey: string, deviceName?: string) =>
    invoke<ActivateResponse>("license_activate", { licenseKey, deviceName }),

  licenseVerify: () => invoke<VerifyResponse>("license_verify"),

  licenseCheck: (licenseKey: string) =>
    invoke<CheckResponse>("license_check", { licenseKey }),

  licenseDeactivate: () => invoke<DeactivateResponse>("license_deactivate"),

  licenseListDevices: () => invoke<DeviceInfo[]>("license_list_devices"),

  licenseGetStatus: () => invoke<LicenseStatus>("license_get_status"),

  licenseGetMaxConnections: () => invoke<number>("license_get_max_connections"),

  licenseIsPro: () => invoke<boolean>("license_is_pro"),

  licenseClear: () => invoke<void>("license_clear"),

  licenseRefresh: () => invoke<LicenseStatus>("license_refresh"),

  getConnectionCount: () => invoke<number>("get_connection_count"),

  getSavedConnectionCount: () => storage.getSavedConnectionCount(),
};
