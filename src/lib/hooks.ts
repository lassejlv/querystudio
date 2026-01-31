import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";
import { useConnectionStore } from "./store";
import { authClient, type ExtendedUser } from "./auth-client";
import type { ConnectionConfig, DatabaseType, SavedConnection } from "./types";

export function useTables(connectionId: string | null) {
  return useQuery({
    queryKey: ["tables", connectionId],
    queryFn: () => api.listTables(connectionId!),
    enabled: !!connectionId,
  });
}

export function useTableColumns(
  connectionId: string | null,
  schema: string | null,
  table: string | null,
) {
  return useQuery({
    queryKey: ["columns", connectionId, schema, table],
    queryFn: () => api.getTableColumns(connectionId!, schema!, table!),
    enabled: !!connectionId && !!schema && !!table,
  });
}

// Fetch columns for all tables (for autocomplete)
export function useAllTableColumns(
  connectionId: string | null,
  tables: { schema: string; name: string }[],
) {
  return useQuery({
    queryKey: ["allColumns", connectionId, tables.map((t) => `${t.schema}.${t.name}`).join(",")],
    queryFn: async () => {
      const columnsMap: Record<
        string,
        { name: string; dataType: string; tableName: string; schema: string }[]
      > = {};

      // Fetch columns for all tables in parallel (batched)
      const results = await Promise.all(
        tables.map(async (table) => {
          try {
            const columns = await api.getTableColumns(connectionId!, table.schema, table.name);
            return { table, columns };
          } catch {
            return { table, columns: [] };
          }
        }),
      );

      for (const { table, columns } of results) {
        const key = `${table.schema}.${table.name}`;
        columnsMap[key] = columns.map((col) => ({
          name: col.name,
          dataType: col.data_type,
          tableName: table.name,
          schema: table.schema,
        }));
      }

      return columnsMap;
    },
    enabled: !!connectionId && tables.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useTableData(
  connectionId: string | null,
  schema: string | null,
  table: string | null,
  limit: number = 100,
  offset: number = 0,
) {
  return useQuery({
    queryKey: ["tableData", connectionId, schema, table, limit, offset],
    queryFn: () => api.getTableData(connectionId!, schema!, table!, limit, offset),
    enabled: !!connectionId && !!schema && !!table,
  });
}

export function useTableCount(
  connectionId: string | null,
  schema: string | null,
  table: string | null,
) {
  return useQuery({
    queryKey: ["tableCount", connectionId, schema, table],
    queryFn: () => api.getTableCount(connectionId!, schema!, table!),
    enabled: !!connectionId && !!schema && !!table,
  });
}

export function useExecuteQuery(connectionId: string | null) {
  return useMutation({
    mutationFn: (query: string) => api.executeQuery(connectionId!, query),
  });
}

export function useInsertRow(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ query }: { schema: string; table: string; query: string }) => {
      return api.executeQuery(connectionId, query);
    },
    onSuccess: (_, { schema, table }) => {
      // Invalidate table data and count queries
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, table],
      });
      queryClient.invalidateQueries({
        queryKey: ["tableCount", connectionId, schema, table],
      });
    },
  });
}

export function useUpdateRow(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ query }: { schema: string; table: string; query: string }) => {
      return api.executeQuery(connectionId, query);
    },
    onSuccess: (_, { schema, table }) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, table],
      });
    },
  });
}

export function useDeleteRow(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ query }: { schema: string; table: string; query: string }) => {
      return api.executeQuery(connectionId, query);
    },
    onSuccess: (_, { schema, table }) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, table],
      });
      queryClient.invalidateQueries({
        queryKey: ["tableCount", connectionId, schema, table],
      });
    },
  });
}

// MongoDB document operations
export function useInsertDocument(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collection,
      document,
    }: {
      schema: string;
      collection: string;
      document: string;
    }) => {
      return api.insertDocument(connectionId, collection, document);
    },
    onSuccess: (_, { schema, collection }) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, collection],
      });
      queryClient.invalidateQueries({
        queryKey: ["tableCount", connectionId, schema, collection],
      });
    },
  });
}

export function useUpdateDocument(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collection,
      filter,
      update,
    }: {
      schema: string;
      collection: string;
      filter: string;
      update: string;
    }) => {
      return api.updateDocument(connectionId, collection, filter, update);
    },
    onSuccess: (_, { schema, collection }) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, collection],
      });
    },
  });
}

export function useDeleteDocument(connectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collection,
      filter,
    }: {
      schema: string;
      collection: string;
      filter: string;
    }) => {
      return api.deleteDocument(connectionId, collection, filter);
    },
    onSuccess: (_, { schema, collection }) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connectionId, schema, collection],
      });
      queryClient.invalidateQueries({
        queryKey: ["tableCount", connectionId, schema, collection],
      });
    },
  });
}

export function useSavedConnections() {
  return useQuery({
    queryKey: ["savedConnections"],
    queryFn: async () => {
      const result = await api.getSavedConnections();
      return result.connections;
    },
  });
}

export function useSaveConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connection: SavedConnection) => api.saveConnection(connection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedConnections"] });
      queryClient.invalidateQueries({ queryKey: ["savedConnectionCount"] });
    },
  });
}

export function useDeleteSavedConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteSavedConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedConnections"] });
      queryClient.invalidateQueries({ queryKey: ["savedConnectionCount"] });
    },
  });
}

export function useConnect() {
  const queryClient = useQueryClient();
  const addConnection = useConnectionStore((s) => s.addConnection);
  const saveConnection = useSaveConnection();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      db_type,
      config,
      save = true,
    }: {
      id: string;
      name: string;
      db_type: DatabaseType;
      config: ConnectionConfig;
      save?: boolean;
    }) => {
      await api.connect(id, config);

      if (save) {
        const savedConfig =
          "connection_string" in config
            ? { connection_string: config.connection_string }
            : {
                host: config.host,
                port: config.port,
                database: config.database,
                username: config.username,
              };
        await saveConnection.mutateAsync({
          id,
          name,
          db_type,
          config: savedConfig,
        });
      }

      return { id, name, db_type, config };
    },
    onSuccess: ({ id, name, db_type, config }) => {
      addConnection({ id, name, db_type, config });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useDisconnect(connectionId?: string) {
  const queryClient = useQueryClient();
  const disconnect = useConnectionStore((s) => s.disconnect);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);

  return useMutation({
    mutationFn: async (id?: string) => {
      const targetConnectionId = id || connectionId || activeConnectionId;
      if (targetConnectionId) {
        await api.disconnect(targetConnectionId);
      }
    },
    onSuccess: (_, id) => {
      const targetConnectionId = id || connectionId || activeConnectionId;
      disconnect(targetConnectionId || undefined);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useDisconnectAll() {
  const queryClient = useQueryClient();
  const disconnectAll = useConnectionStore((s) => s.disconnectAll);
  const activeConnections = useConnectionStore((s) => s.activeConnections);

  return useMutation({
    mutationFn: async () => {
      for (const connection of activeConnections) {
        await api.disconnect(connection.id);
      }
    },
    onSuccess: () => {
      disconnectAll();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      // Navigate back to home page
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (config: ConnectionConfig) => api.testConnection(config),
  });
}

// User status hooks - using auth session as source of truth
const MAX_FREE_CONNECTIONS = 2;

/**
 * Hook to sync auth session's isPro status to the Tauri backend
 * Should be used at the app root level
 */
export function useSyncProStatus() {
  const { data: session } = authClient.useSession();
  // Cast user to ExtendedUser to access custom fields from the server
  const user = session?.user as ExtendedUser | undefined;

  useEffect(() => {
    const isPro = user?.isPro ?? false;
    // Sync to backend
    api.setUserProStatus(isPro).catch((err) => {
      console.error("Failed to sync pro status to backend:", err);
    });
  }, [user?.isPro]);
}

export function useConnectionCount() {
  return useQuery({
    queryKey: ["connectionCount"],
    queryFn: () => api.getConnectionCount(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useSavedConnectionCount() {
  return useQuery({
    queryKey: ["savedConnectionCount"],
    queryFn: () => api.getSavedConnectionCount(),
  });
}

/**
 * Hook to check if user can create a new connection
 * Uses auth session's isPro status
 */
export function useCanConnect() {
  const { data: session } = authClient.useSession();
  const { data: connectionCount } = useConnectionCount();
  // Cast user to ExtendedUser to access custom fields from the server
  const user = session?.user as ExtendedUser | undefined;

  const isPro = user?.isPro ?? false;
  const maxConnections = isPro ? Infinity : MAX_FREE_CONNECTIONS;
  const currentConnections = connectionCount ?? 0;
  const canConnect = currentConnections < maxConnections;

  return {
    canConnect,
    currentConnections,
    maxConnections,
    isPro,
    remainingConnections: Math.max(0, maxConnections - currentConnections),
  };
}

/**
 * Hook to check if user can save a new connection
 * Uses auth session's isPro status
 */
export function useCanSaveConnection() {
  const { data: session } = authClient.useSession();
  const { data: savedConnectionCount } = useSavedConnectionCount();
  // Cast user to ExtendedUser to access custom fields from the server
  const user = session?.user as ExtendedUser | undefined;

  const isPro = user?.isPro ?? false;
  const maxSaved = isPro ? Infinity : MAX_FREE_CONNECTIONS;
  const currentSaved = savedConnectionCount ?? 0;
  const canSave = currentSaved < maxSaved;

  return {
    canSave,
    currentSaved,
    maxSaved,
    isPro,
    remainingSaved: Math.max(0, maxSaved - currentSaved),
  };
}
