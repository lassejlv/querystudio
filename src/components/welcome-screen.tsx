import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedConnections } from "@/lib/hooks";
import { getLastConnectionId, useLicenseStore } from "@/lib/store";
import type { DatabaseType, SavedConnection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LicenseSettings } from "@/components/license-settings";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

function DatabaseIcon({
  type,
  className,
}: {
  type: DatabaseType;
  className?: string;
}) {
  if (type === "mysql") {
    return (
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded bg-orange-500/20 text-[10px] font-bold text-orange-500",
          className,
        )}
      >
        M
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[10px] font-bold text-blue-500",
        className,
      )}
    >
      P
    </span>
  );
}

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
  const [licenseSettingsOpen, setLicenseSettingsOpen] = useState(false);
  const { status, setStatus } = useLicenseStore();

  // Load license status on mount
  useEffect(() => {
    const loadLicenseStatus = async () => {
      try {
        const licenseStatus = await api.licenseGetStatus();
        setStatus(licenseStatus);
      } catch (err) {
        console.error("Failed to load license status:", err);
      }
    };
    loadLicenseStatus();
  }, [setStatus]);

  useEffect(() => {
    if (isLoading || autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;

    const lastConnectionId = getLastConnectionId();
    if (lastConnectionId && savedConnections) {
      const lastConnection = savedConnections.find(
        (c) => c.id === lastConnectionId,
      );
      if (lastConnection) {
        onSelectConnection(lastConnection);
      }
    }
  }, [isLoading, savedConnections, onSelectConnection]);

  const getConnectionDescription = (connection: SavedConnection) => {
    const dbLabel = connection.db_type === "mysql" ? "MySQL" : "PostgreSQL";
    if ("connection_string" in connection.config) {
      return `${dbLabel} · Connection string`;
    }
    return `${dbLabel} · ${connection.config.host}:${connection.config.port}/${connection.config.database}`;
  };

  const isPro = status?.is_pro && status?.is_activated;

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <span className="text-lg font-medium text-foreground">
              QueryStudio
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant={isPro ? "default" : "secondary"}
                className="text-xs"
              >
                {isPro
                  ? "Pro"
                  : `Free · ${status?.max_connections || 2} connections`}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLicenseSettingsOpen(true)}
                title="License Settings"
              >
                <Key className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {!isLoading && savedConnections && savedConnections.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-2">
                Recent connections
              </p>
              <div className="space-y-1">
                {savedConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-secondary transition-colors"
                  >
                    <button
                      onClick={() => onSelectConnection(connection)}
                      className="flex flex-1 items-start gap-3 min-w-0 text-left"
                    >
                      <DatabaseIcon type={connection.db_type || "postgres"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">
                          {connection.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getConnectionDescription(connection)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditConnection(connection);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-opacity"
                      title="Edit connection"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={onNewConnection} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Connection
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            <kbd className="px-1 py-0.5 rounded bg-secondary font-mono text-[10px]">
              ⌘K
            </kbd>{" "}
            command palette
          </p>
        </div>
      </div>

      <LicenseSettings
        open={licenseSettingsOpen}
        onOpenChange={setLicenseSettingsOpen}
      />
    </div>
  );
}
