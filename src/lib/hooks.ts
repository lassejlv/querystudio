import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "./api";
import { useConnectionStore } from "./store";
import type { ConnectionConfig, SavedConnection } from "./types";

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
  table: string | null
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
  tables: { schema: string; name: string }[]
) {
  return useQuery({
    queryKey: ["allColumns", connectionId, tables.map(t => `${t.schema}.${t.name}`).join(",")],
    queryFn: async () => {
      const columnsMap: Record<string, { name: string; dataType: string; tableName: string; schema: string }[]> = {};
      
      // Fetch columns for all tables in parallel (batched)
      const results = await Promise.all(
        tables.map(async (table) => {
          try {
            const columns = await api.getTableColumns(connectionId!, table.schema, table.name);
            return { table, columns };
          } catch {
            return { table, columns: [] };
          }
        })
      );
      
      for (const { table, columns } of results) {
        const key = `${table.schema}.${table.name}`;
        columnsMap[key] = columns.map(col => ({
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
  offset: number = 0
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
  table: string | null
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
      config,
      save = true,
    }: {
      id: string;
      name: string;
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
        await saveConnection.mutateAsync({ id, name, config: savedConfig });
      }

      return { id, name, config };
    },
    onSuccess: ({ id, name, config }) => {
      setConnection({ id, name, config });
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

// ============================================================================
// License Hooks
// ============================================================================

export function useLicenseStatus() {
  return useQuery({
    queryKey: ["licenseStatus"],
    queryFn: () => api.getLicenseStatus(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}

export function useValidateLicense() {
  return useMutation({
    mutationFn: (licenseKey: string) => api.validateLicense(licenseKey),
  });
}

export function useActivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (licenseKey: string) => api.activateLicense(licenseKey),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
      }
    },
  });
}

export function useDeactivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.deactivateLicense(),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
      }
    },
  });
}

export function useRevalidateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.revalidateLicense(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
    },
  });
}

const REVALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook that manages license validation:
 * - Checks license status on mount
 * - Revalidates on startup if license exists
 * - Periodically revalidates every 5 minutes
 * - Returns current license status and loading state
 */
export function useLicenseValidation() {
  const queryClient = useQueryClient();
  const { data: licenseStatus, isLoading, refetch } = useLicenseStatus();
  const revalidate = useRevalidateLicense();
  const hasRevalidatedOnStartup = useRef(false);

  // Revalidate on startup (once) if we have a stored license
  useEffect(() => {
    if (hasRevalidatedOnStartup.current) return;
    if (isLoading) return;
    
    if (licenseStatus) {
      hasRevalidatedOnStartup.current = true;
      // Revalidate with the server
      revalidate.mutate(undefined, {
        onSuccess: (isValid) => {
          if (!isValid) {
            // License is no longer valid, refetch status to clear it
            refetch();
          }
        },
        onError: () => {
          // If revalidation fails (network error), keep the cached license
          // It will be checked again on the next interval
          console.warn("License revalidation failed, will retry later");
        },
      });
    }
  }, [licenseStatus, isLoading, revalidate, refetch]);

  // Periodic revalidation every 5 minutes
  useEffect(() => {
    if (!licenseStatus) return;

    const interval = setInterval(() => {
      revalidate.mutate(undefined, {
        onSuccess: (isValid) => {
          if (!isValid) {
            queryClient.invalidateQueries({ queryKey: ["licenseStatus"] });
          }
        },
      });
    }, REVALIDATION_INTERVAL);

    return () => clearInterval(interval);
  }, [licenseStatus, revalidate, queryClient]);

  return {
    licenseStatus,
    isLoading,
    isRevalidating: revalidate.isPending,
    refetch,
  };
}
