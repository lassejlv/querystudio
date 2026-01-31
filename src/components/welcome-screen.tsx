import { useEffect, useRef } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedConnections, useCanSaveConnection, useDeleteSavedConnection } from "@/lib/hooks";
import { getLastConnectionId, useAIQueryStore } from "@/lib/store";
import type { SavedConnection } from "@/lib/types";
import { DatabaseIcon } from "./sidebar";

interface WelcomeScreenProps {
  onNewConnection: () => void;
  onSelectConnection: (connection: SavedConnection) => void;
  onEditConnection: (connection: SavedConnection) => void;
}

export function WelcomeScreen({
  onNewConnection,
  onSelectConnection,
  onEditConnection,
}: WelcomeScreenProps) {
  const { data: savedConnections, isLoading } = useSavedConnections();
  const autoConnectAttempted = useRef(false);
  const { canSave, currentSaved, maxSaved, isPro } = useCanSaveConnection();
  const autoReconnect = useAIQueryStore((s) => s.autoReconnect);
  const deleteConnection = useDeleteSavedConnection();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConnection.mutate(id);
  };

  useEffect(() => {
    if (isLoading || autoConnectAttempted.current || !autoReconnect) return;
    autoConnectAttempted.current = true;

    const lastConnectionId = getLastConnectionId();
    if (lastConnectionId && savedConnections) {
      const lastConnection = savedConnections.find((c) => c.id === lastConnectionId);
      if (lastConnection) {
        onSelectConnection(lastConnection);
      }
    }
  }, [isLoading, savedConnections, onSelectConnection, autoReconnect]);

  const getConnectionDescription = (connection: SavedConnection) => {
    const dbLabel =
      connection.db_type === "mysql"
        ? "MySQL"
        : connection.db_type === "redis"
          ? "Redis"
          : connection.db_type === "postgres"
            ? "PostgreSQL"
            : connection.db_type === "sqlite"
              ? "SQLite"
              : connection.db_type === "mongodb"
                ? "MongoDB"
                : "Unknown";

    if ("connection_string" in connection.config) {
      return `${dbLabel} · Connection string`;
    }

    return `${dbLabel} · ${connection.config.host}`;
  };

  return (
    <div className="flex h-screen w-full flex-col">
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-lg font-medium">Connections</h1>
            <span className="text-xs text-muted-foreground">
              {isPro ? "Pro" : `${currentSaved}/${maxSaved}`}
            </span>
          </div>

          <div className="mb-4">
            {!isLoading && savedConnections && savedConnections.length > 0 ? (
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                {savedConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded px-2 py-2 text-left transition-colors hover:bg-muted"
                    onClick={() => onSelectConnection(connection)}
                  >
                    <DatabaseIcon type={connection.db_type || "postgres"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{connection.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getConnectionDescription(connection)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditConnection(connection);
                      }}
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Edit connection"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, connection.id)}
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete connection"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No connections yet</p>
            )}
          </div>

          <Button
            onClick={onNewConnection}
            variant="outline"
            className="w-full"
            disabled={!canSave}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Connection
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> command
            palette
          </p>
        </div>
      </div>
    </div>
  );
}
