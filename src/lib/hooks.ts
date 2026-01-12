import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useConnectionStore, useLicenseStore } from "./store";
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
    queryKey: [
      "allColumns",
      connectionId,
      tables.map((t) => `${t.schema}.${t.name}`).join(","),
    ],
    queryFn: async () => {
      const columnsMap: Record<
        string,
        { name: string; dataType: string; tableName: string; schema: string }[]
      > = {};

      // Fetch columns for all tables in parallel (batched)
      const results = await Promise.all(
        tables.map(async (table) => {
          try {
            const columns = await api.getTableColumns(
              connectionId!,
              table.schema,
              table.name,
            );
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
    queryFn: () =>
      api.getTableData(connectionId!, schema!, table!, limit, offset),
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
    mutationFn: async ({
      query,
    }: {
      schema: string;
      table: string;
      query: string;
    }) => {
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
    mutationFn: async ({
      query,
    }: {
      schema: string;
      table: string;
      query: string;
    }) => {
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
    mutationFn: async ({
      query,
    }: {
      schema: string;
      table: string;
      query: string;
    }) => {
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
  const setConnection = useConnectionStore((s) => s.setConnection);
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
      setConnection({ id, name, db_type, config });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();
  const disconnect = useConnectionStore((s) => s.disconnect);
  const connection = useConnectionStore((s) => s.connection);

  return useMutation({
    mutationFn: async () => {
      if (connection) {
        await api.disconnect(connection.id);
      }
    },
    onSuccess: () => {
      disconnect();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (config: ConnectionConfig) => api.testConnection(config),
  });
}

// License hooks
export function useLicenseStatus() {
  const { setStatus } = useLicenseStore();

  return useQuery({
    queryKey: ["licenseStatus"],
    queryFn: async () => {
      // Use refresh to verify with remote API and update local state
      const status = await api.licenseRefresh();
      setStatus(status);
      return status;
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes to catch revoked licenses
    refetchOnWindowFocus: true, // Refresh when user returns to the app
  });
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

export function useCanConnect() {
  const { data: licenseStatus } = useLicenseStatus();
  const { data: connectionCount } = useConnectionCount();

  const maxConnections = licenseStatus?.max_connections ?? 2;
  const currentConnections = connectionCount ?? 0;
  const canConnect = currentConnections < maxConnections;
  const isPro = licenseStatus?.is_pro && licenseStatus?.is_activated;

  return {
    canConnect,
    currentConnections,
    maxConnections,
    isPro,
    remainingConnections: Math.max(0, maxConnections - currentConnections),
  };
}

export function useCanSaveConnection() {
  const { data: licenseStatus } = useLicenseStatus();
  const { data: savedConnectionCount } = useSavedConnectionCount();

  const maxSaved = licenseStatus?.max_connections ?? 2;
  const currentSaved = savedConnectionCount ?? 0;
  const canSave = currentSaved < maxSaved;
  const isPro = licenseStatus?.is_pro && licenseStatus?.is_activated;

  return {
    canSave,
    currentSaved,
    maxSaved,
    isPro,
    remainingSaved: Math.max(0, maxSaved - currentSaved),
  };
}

export function useLicenseActivate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      licenseKey,
      deviceName,
    }: {
      licenseKey: string;
      deviceName?: string;
    }) => api.licenseActivate(licenseKey, deviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
    },
  });
}

export function useLicenseDeactivate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.licenseDeactivate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
    },
  });
}

export function useLicenseVerify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.licenseVerify(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
    },
  });
}

export function useLicenseRefresh() {
  const queryClient = useQueryClient();
  const { setStatus } = useLicenseStore();

  return useMutation({
    mutationFn: async () => {
      const status = await api.licenseRefresh();
      setStatus(status);
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
    },
  });
}
