// ============================================================================
// Test Tab Plugin
// ============================================================================
//
// This is a sample local plugin that demonstrates how to create a custom
// tab type using the Tab SDK and Plugin SDK. It serves as a template for
// developing your own tab plugins.
//
// Features demonstrated:
// - Using the Plugin SDK to access connection data
// - Executing queries through the API
// - Using utility functions (toast, clipboard, formatting)
// - Layout operations (creating tabs, updating title)
//
// ============================================================================

import { useState, useCallback } from "react";
import {
  FlaskConical,
  Database,
  Table2,
  Play,
  Copy,
  RefreshCw,
  Sparkles,
  Terminal,
  Clock,
  Rows3,
} from "lucide-react";
import type { TabPluginRegistration, TabContentProps } from "@/lib/tab-sdk";
import type { LocalPluginModule } from "@/lib/local-plugins";
import { usePluginSDK } from "@/lib/plugin-sdk";

// ============================================================================
// Plugin Definition
// ============================================================================

export const plugin: TabPluginRegistration = {
  type: "test-tab",
  displayName: "Test Tab",
  icon: FlaskConical,
  getDefaultTitle: (index) => `Test Tab ${index}`,
  canCreate: true,
  allowMultiple: true,
  priority: 50,
  experimental: false,
  lifecycle: {
    onCreate: (tabId, metadata) => {
      console.log(`[TestTab] Created: ${tabId}`, metadata);
    },
    onClose: (tabId) => {
      console.log(`[TestTab] Closed: ${tabId}`);
    },
    onActivate: (tabId) => {
      console.log(`[TestTab] Activated: ${tabId}`);
    },
    onDeactivate: (tabId) => {
      console.log(`[TestTab] Deactivated: ${tabId}`);
    },
  },
};

// ============================================================================
// Tab Component
// ============================================================================

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  // Get the Plugin SDK - this gives us access to everything!
  const sdk = usePluginSDK(connectionId, tabId, paneId);

  // Local state for query results
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: unknown[][];
    rowCount: number;
    executionTime: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState("SELECT 1 + 1 AS result");

  // Execute a sample query
  const executeQuery = useCallback(async () => {
    if (!sdk.connection.isConnected) {
      sdk.utils.toast.error("Not connected to a database");
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const result = await sdk.api.executeQuery(customQuery);
      const executionTime = Date.now() - startTime;

      if (result) {
        setQueryResult({
          columns: result.columns,
          rows: result.rows,
          rowCount: result.row_count,
          executionTime,
        });
        sdk.utils.toast.success(
          `Query executed in ${sdk.utils.format.duration(executionTime)}`,
        );
      }
    } catch (error) {
      sdk.utils.toast.error(`Query failed: ${error}`);
      setQueryResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, customQuery]);

  // Copy connection info to clipboard
  const copyConnectionInfo = useCallback(async () => {
    const info = {
      connectionId: sdk.connectionId,
      databaseType: sdk.connection.databaseType,
      tableCount: sdk.connection.tables.length,
      selectedTable: sdk.connection.selectedTable,
    };
    const success = await sdk.utils.clipboard.copy(
      JSON.stringify(info, null, 2),
    );
    if (success) {
      sdk.utils.toast.success("Connection info copied to clipboard");
    } else {
      sdk.utils.toast.error("Failed to copy to clipboard");
    }
  }, [sdk]);

  // Create a new query tab
  const openQueryTab = useCallback(() => {
    sdk.layout.createTab("query", {
      title: "New Query from Plugin",
    });
    sdk.utils.toast.info("Created new query tab");
  }, [sdk]);

  // Refresh tables list
  const refreshTables = useCallback(async () => {
    if (!sdk.connection.isConnected) {
      sdk.utils.toast.error("Not connected to a database");
      return;
    }

    try {
      const tables = await sdk.api.listTables();
      sdk.utils.toast.success(`Found ${tables.length} tables`);
    } catch (error) {
      sdk.utils.toast.error(`Failed to refresh tables: ${error}`);
    }
  }, [sdk]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Plugin SDK Demo
            </h1>
            <p className="text-sm text-muted-foreground">
              Demonstrating Plugin SDK features and capabilities
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Connection Status Card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-primary" />
              Connection Status
            </h2>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={`text-sm font-medium ${
                    sdk.connection.isConnected
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {sdk.connection.isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              {sdk.connection.isConnected && (
                <>
                  <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      Database Type
                    </span>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      {sdk.connection.databaseType || "Unknown"}
                    </code>
                  </div>
                  <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      Tables
                    </span>
                    <span className="text-sm font-medium">
                      {sdk.utils.format.number(sdk.connection.tables.length)}
                    </span>
                  </div>
                  {sdk.connection.selectedTable && (
                    <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
                      <span className="text-sm text-muted-foreground">
                        Selected Table
                      </span>
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {sdk.connection.selectedTable.schema}.
                        {sdk.connection.selectedTable.name}
                      </code>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyConnectionInfo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Info
              </button>
              <button
                onClick={refreshTables}
                disabled={!sdk.connection.isConnected}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Tables
              </button>
            </div>
          </div>

          {/* Tables List */}
          {sdk.connection.isConnected && sdk.connection.tables.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Table2 className="h-4 w-4 text-primary" />
                Available Tables ({sdk.connection.tables.length})
              </h2>
              <div className="max-h-40 overflow-auto">
                <div className="grid grid-cols-2 gap-1">
                  {sdk.connection.tables.slice(0, 20).map((table) => (
                    <button
                      key={`${table.schema}.${table.name}`}
                      onClick={() =>
                        sdk.connection.selectTable(table.schema, table.name)
                      }
                      className={`rounded px-2 py-1 text-left text-xs font-mono transition-colors ${
                        sdk.connection.selectedTable?.schema === table.schema &&
                        sdk.connection.selectedTable?.name === table.name
                          ? "bg-primary/20 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {table.schema}.{table.name}
                    </button>
                  ))}
                </div>
                {sdk.connection.tables.length > 20 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ...and {sdk.connection.tables.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Query Execution */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              Execute Query (via Plugin SDK)
            </h2>
            <div className="space-y-3">
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                placeholder="Enter SQL query..."
              />
              <button
                onClick={executeQuery}
                disabled={isLoading || !sdk.connection.isConnected}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Execute Query
              </button>
            </div>

            {/* Query Results */}
            {queryResult && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Rows3 className="h-3.5 w-3.5" />
                    {sdk.utils.format.number(queryResult.rowCount)} rows
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {sdk.utils.format.duration(queryResult.executionTime)}
                  </span>
                </div>
                <div className="max-h-48 overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th
                            key={col}
                            className="px-2 py-1.5 text-left font-medium"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1.5 font-mono">
                              {String(cell ?? "NULL")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Layout Operations */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Layout Operations
            </h2>
            <div className="flex gap-2">
              <button
                onClick={openQueryTab}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                Create Query Tab
              </button>
              <button
                onClick={() => {
                  const newTitle = `Test Tab (${new Date().toLocaleTimeString()})`;
                  sdk.layout.updateTitle(newTitle);
                  sdk.utils.toast.success(`Title updated to: ${newTitle}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                Update Tab Title
              </button>
            </div>
          </div>

          {/* Tab Context Info */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Tab Context (from TabContentProps)
            </h2>
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              <div>tabId: {tabId}</div>
              <div>paneId: {paneId}</div>
              <div>connectionId: {connectionId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export as LocalPluginModule
// ============================================================================

const testTabPlugin: LocalPluginModule = {
  plugin,
  Component,
};

export default testTabPlugin;
