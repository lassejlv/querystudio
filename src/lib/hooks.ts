import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useConnectionStore } from "./store";
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
    },
  });
}

export function useDeleteSavedConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteSavedConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedConnections"] });
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
