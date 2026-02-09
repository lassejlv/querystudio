import { useEffect, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, Command, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedConnections, useCanSaveConnection, useDeleteSavedConnection } from "@/lib/hooks";
import { getLastConnectionId, useAIQueryStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SavedConnection } from "@/lib/types";
import { DatabaseIcon } from "./sidebar";
import { Spinner } from "./ui/spinner";
import { authClient } from "@/lib/auth-client";

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
  const session = authClient.useSession();

  const connectionTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      postgres: 0,
      mysql: 0,
      sqlite: 0,
      redis: 0,
      mongodb: 0,
    };
    for (const connection of savedConnections ?? []) {
      const key = connection.db_type || "postgres";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [savedConnections]);

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

    const hostLabel = connection.config.host || "Local";
    return `${dbLabel} · ${hostLabel}`;
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,hsl(var(--primary)/0.12),transparent_40%),radial-gradient(circle_at_80%_84%,hsl(var(--primary)/0.08),transparent_44%)]" />

      <div className="relative flex flex-1 items-center justify-center px-4 pb-6 pt-3">
        <div className="w-full max-w-5xl rounded-3xl border border-border/60 bg-card/45 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.3)] md:p-6">
          {session.data && <></>}
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.45fr]">
            <section className="rounded-2xl border border-border/55 bg-background/55 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Querystudio</h1>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Jump back into one of your saved connections or create a new one.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/55 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saved</p>
                  <p className="mt-1 text-lg font-semibold">{savedConnections?.length ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border/55 bg-background/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plan</p>
                  <p className="mt-1 text-lg font-semibold">
                    {isPro ? "Pro" : `${currentSaved}/${maxSaved}`}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Button
                  onClick={onNewConnection}
                  className="h-10 w-full rounded-xl"
                  disabled={!canSave}
                  variant="secondary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Connection
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-2 py-1 font-mono text-[11px]">
                    <Command className="mr-1 h-3 w-3" />K
                  </span>
                  <span>Command palette</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/55 bg-background/45 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Connections</h2>
                <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                  {savedConnections?.length ?? 0} total
                </span>
              </div>

              {isLoading ? (
                <div className="flex h-56 items-center justify-center text-muted-foreground">
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Loading connections...
                </div>
              ) : savedConnections && savedConnections.length > 0 ? (
                <div className="max-h-95 space-y-1.5 overflow-y-auto pr-1">
                  {savedConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-background/45 px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-background/75"
                      onClick={() => onSelectConnection(connection)}
                    >
                      <DatabaseIcon type={connection.db_type || "postgres"} className="h-7 w-7" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-foreground">
                          {connection.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getConnectionDescription(connection)}
                        </p>
                      </div>

                      <div className="hidden items-center gap-1 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditConnection(connection);
                          }}
                          className="h-7 w-7 rounded-lg"
                          title="Edit connection"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(e, connection.id)}
                          className={cn(
                            "h-7 w-7 rounded-lg",
                            deleteConnection.isPending &&
                              deleteConnection.variables === connection.id &&
                              "opacity-50",
                          )}
                          disabled={
                            deleteConnection.isPending &&
                            deleteConnection.variables === connection.id
                          }
                          title="Delete connection"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/35 p-4 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/60">
                    <Database className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No connections yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first connection to start querying.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
