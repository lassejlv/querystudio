// ============================================================================
// Plugin SDK - Provides plugins with access to QueryStudio functionality
// ============================================================================
//
// This SDK exposes APIs, connection data, and utilities that plugins can use
// to interact with QueryStudio. Plugins receive these through React hooks
// and context.
//
// Usage in a plugin component:
//
// import { usePluginSDK } from "@/lib/plugin-sdk";
//
// function MyPluginComponent({ tabId, paneId, connectionId }: TabContentProps) {
//   const sdk = usePluginSDK(connectionId);
//
//   // Access connection info
//   const tables = sdk.connection.tables;
//
//   // Execute queries
//   const result = await sdk.api.executeQuery("SELECT * FROM users");
//
//   // Show notifications
//   sdk.utils.toast.success("Query executed!");
// }
//
// ============================================================================

import { useMemo } from "react";
import { useConnectionStore } from "./store";
import { useLayoutStore } from "./layout-store";
import { api } from "./api";
import { toast } from "sonner";
import type { Connection, TableInfo, ColumnInfo, QueryResult, ConnectionConfig } from "./types";

// ============================================================================
// Types
// ============================================================================

/** Current connection information */
export interface PluginConnectionInfo {
  /** The connection object (null if not connected) */
  connection: Connection | null;
  /** Whether there is an active connection */
  isConnected: boolean;
  /** Connection ID */
  connectionId: string | null;
  /** Database type (postgres, mysql, sqlite, etc.) */
  databaseType: string | null;
  /** List of tables in the database */
  tables: TableInfo[];
  /** Currently selected table */
  selectedTable: { schema: string; name: string } | null;
  /** Select a table */
  selectTable: (schema: string, name: string) => void;
  /** Clear table selection */
  clearSelection: () => void;
}

/** API functions available to plugins */
export interface PluginAPI {
  /** Execute a SQL query and return results */
  executeQuery: (query: string) => Promise<QueryResult | null>;
  /** Get list of tables */
  listTables: () => Promise<TableInfo[]>;
  /** Get columns for a specific table */
  getTableColumns: (schema: string, table: string) => Promise<ColumnInfo[]>;
  /** Get data from a table with pagination */
  getTableData: (
    schema: string,
    table: string,
    limit?: number,
    offset?: number,
  ) => Promise<QueryResult>;
  /** Get row count for a table */
  getTableCount: (schema: string, table: string) => Promise<number>;
  /** Test a connection configuration */
  testConnection: (config: ConnectionConfig) => Promise<void>;
}

/** Utility functions for plugins */
export interface PluginUtils {
  /** Toast notifications */
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
    loading: (message: string) => string | number;
    dismiss: (id?: string | number) => void;
  };
  /** Clipboard operations */
  clipboard: {
    copy: (text: string) => Promise<boolean>;
    read: () => Promise<string>;
  };
  /** Format utilities */
  format: {
    /** Format a number with locale formatting */
    number: (value: number, options?: Intl.NumberFormatOptions) => string;
    /** Format a date */
    date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    /** Format bytes to human readable string */
    bytes: (bytes: number, decimals?: number) => string;
    /** Format a duration in milliseconds to human readable */
    duration: (ms: number) => string;
  };
  /** SQL utilities */
  sql: {
    /** Escape a string for use in SQL */
    escapeString: (value: string) => string;
    /** Escape an identifier (table/column name) */
    escapeIdentifier: (identifier: string) => string;
    /** Format SQL for display (basic formatting) */
    format: (sql: string) => string;
  };
}

/** Tab/Layout operations */
export interface PluginLayout {
  /** Create a new tab */
  createTab: (
    type: string,
    options?: {
      title?: string;
      metadata?: Record<string, unknown>;
    },
  ) => void;
  /** Close the current tab */
  closeCurrentTab: () => void;
  /** Update the current tab's title */
  updateTitle: (title: string) => void;
  /** Get all tabs in the current pane */
  getTabs: () => Array<{ id: string; type: string; title: string }>;
}

/** The complete Plugin SDK */
export interface PluginSDK {
  /** Connection information and operations */
  connection: PluginConnectionInfo;
  /** Database API functions */
  api: PluginAPI;
  /** Utility functions */
  utils: PluginUtils;
  /** Layout/tab operations */
  layout: PluginLayout;
  /** The current tab ID */
  tabId: string;
  /** The current pane ID */
  paneId: string;
  /** The current connection ID */
  connectionId: string;
}

// ============================================================================
// Implementation
// ============================================================================

/** Format bytes to human readable string */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/** Format duration in ms to human readable */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/** Escape a string for SQL */
function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

/** Escape an identifier for SQL */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** Basic SQL formatting */
function formatSQL(sql: string): string {
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "ON",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "CREATE TABLE",
    "ALTER TABLE",
    "DROP TABLE",
  ];

  let formatted = sql.trim();

  // Add newlines before major keywords
  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    formatted = formatted.replace(regex, `\n${keyword}`);
  });

  // Clean up multiple newlines and trim
  formatted = formatted.replace(/\n\s*\n/g, "\n").trim();

  return formatted;
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook that provides the Plugin SDK to plugin components
 *
 * @param connectionId - The connection ID from TabContentProps
 * @param tabId - The tab ID from TabContentProps
 * @param paneId - The pane ID from TabContentProps
 * @returns The Plugin SDK instance
 */
export function usePluginSDK(connectionId: string, tabId: string, paneId: string): PluginSDK {
  // Get connection state
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const tables = useConnectionStore((s) => s.tables);
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const setSelectedTable = useConnectionStore((s) => s.setSelectedTable);

  // Get layout state
  const createTabFn = useLayoutStore((s) => s.createTab);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const updateTab = useLayoutStore((s) => s.updateTab);
  const panes = useLayoutStore((s) => s.panes);

  // Connection info
  const connectionInfo: PluginConnectionInfo = useMemo(
    () => ({
      connection,
      isConnected: connection !== null,
      connectionId: connection?.id ?? null,
      databaseType: connection?.db_type ?? null,
      tables,
      selectedTable,
      selectTable: (schema: string, name: string) => setSelectedTable({ schema, name }),
      clearSelection: () => setSelectedTable(null),
    }),
    [connection, tables, selectedTable, setSelectedTable],
  );

  // API functions - wrapped to use current connectionId
  const pluginAPI: PluginAPI = useMemo(
    () => ({
      executeQuery: async (query: string) => {
        const result = await api.executeQuery(connectionId, query);
        return result;
      },
      listTables: () => api.listTables(connectionId),
      getTableColumns: (schema: string, table: string) =>
        api.getTableColumns(connectionId, schema, table),
      getTableData: (schema: string, table: string, limit = 100, offset = 0) =>
        api.getTableData(connectionId, schema, table, limit, offset),
      getTableCount: (schema: string, table: string) =>
        api.getTableCount(connectionId, schema, table),
      testConnection: (config: ConnectionConfig) => api.testConnection(config),
    }),
    [connectionId],
  );

  // Utility functions
  const utils: PluginUtils = useMemo(
    () => ({
      toast: {
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message),
        info: (message: string) => toast.info(message),
        warning: (message: string) => toast.warning(message),
        loading: (message: string) => toast.loading(message),
        dismiss: (id?: string | number) => toast.dismiss(id),
      },
      clipboard: {
        copy: async (text: string) => {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        },
        read: async () => {
          try {
            return await navigator.clipboard.readText();
          } catch {
            return "";
          }
        },
      },
      format: {
        number: (value: number, options?: Intl.NumberFormatOptions) =>
          new Intl.NumberFormat(undefined, options).format(value),
        date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
          new Intl.DateTimeFormat(undefined, options).format(new Date(value)),
        bytes: formatBytes,
        duration: formatDuration,
      },
      sql: {
        escapeString,
        escapeIdentifier,
        format: formatSQL,
      },
    }),
    [],
  );

  // Layout operations
  const layout: PluginLayout = useMemo(
    () => ({
      createTab: (
        type: string,
        options?: { title?: string; metadata?: Record<string, unknown> },
      ) => {
        createTabFn(connectionId, paneId, type as any, {
          title: options?.title,
          metadata: options?.metadata,
          makeActive: true,
        });
      },
      closeCurrentTab: () => {
        closeTab(connectionId, paneId, tabId);
      },
      updateTitle: (title: string) => {
        updateTab(connectionId, paneId, tabId, { title });
      },
      getTabs: () => {
        const pane = panes[connectionId]?.[paneId];
        if (pane?.type === "leaf") {
          return pane.tabs.map((t) => ({
            id: t.id,
            type: t.type,
            title: t.title,
          }));
        }
        return [];
      },
    }),
    [connectionId, paneId, tabId, createTabFn, closeTab, updateTab, panes],
  );

  // Combine into SDK
  const sdk: PluginSDK = useMemo(
    () => ({
      connection: connectionInfo,
      api: pluginAPI,
      utils,
      layout,
      tabId,
      paneId,
      connectionId,
    }),
    [connectionInfo, pluginAPI, utils, layout, tabId, paneId, connectionId],
  );

  return sdk;
}

// ============================================================================
// Standalone utilities (for use outside of React components)
// ============================================================================

/** Get the raw API object for direct access */
export { api } from "./api";

/** Standalone format utilities */
export const formatUtils = {
  bytes: formatBytes,
  duration: formatDuration,
  number: (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(undefined, options).format(value),
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(undefined, options).format(new Date(value)),
};

/** Standalone SQL utilities */
export const sqlUtils = {
  escapeString,
  escapeIdentifier,
  format: formatSQL,
};

/** Clipboard utilities */
export const clipboardUtils = {
  copy: async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  read: async (): Promise<string> => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  },
};

/** Toast utilities (re-exported from sonner) */
export const toastUtils = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast.info(message),
  warning: (message: string) => toast.warning(message),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
