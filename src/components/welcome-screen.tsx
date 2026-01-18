import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedConnections, useCanSaveConnection } from "@/lib/hooks";
import {
  getLastConnectionId,
  useLicenseStore,
  useAIQueryStore,
} from "@/lib/store";
import type { SavedConnection } from "@/lib/types";
import { LicenseSettings } from "@/components/license-settings";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { DatabaseIcon } from "./sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  const { setStatus } = useLicenseStore();
  const { canSave, currentSaved, maxSaved, isPro } = useCanSaveConnection();
  const autoReconnect = useAIQueryStore((s) => s.autoReconnect);

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
    if (isLoading || autoConnectAttempted.current || !autoReconnect) return;
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
              : "Unkown";

    if ("connection_string" in connection.config) {
      return `${dbLabel} · Connection string`;
    }

    return `${dbLabel} · ${connection.config.host}`;
  };

  return (
    <div className="flex h-screen w-full flex-col bg-muted/10">
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-[420px] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">QueryStudio</CardTitle>
              <CardDescription>Manage your connections</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={isPro ? "default" : "secondary"}
                className="text-xs"
              >
                {isPro ? "Pro" : `${currentSaved}/${maxSaved}`}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLicenseSettingsOpen(true)}
                title="License Settings"
                className="h-8 w-8"
              >
                <Key className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {!isLoading && savedConnections && savedConnections.length > 0 ? (
              <ScrollArea className="h-[300px] w-full p-4">
                <div className="flex flex-col gap-1">
                  {savedConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => onSelectConnection(connection)}
                    >
                      <DatabaseIcon type={connection.db_type || "postgres"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-none">
                          {connection.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
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
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        title="Edit connection"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-[200px] items-center justify-center p-4 text-center text-sm text-muted-foreground">
                No connections saved yet.
                <br />
                Create one to get started.
              </div>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex-col gap-3 bg-muted/5 p-4">
            <Button
              onClick={onNewConnection}
              className="w-full"
              disabled={!canSave}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Connection
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                ⌘K
              </kbd>{" "}
              to open command palette
            </p>
          </CardFooter>
        </Card>
      </div>

      <LicenseSettings
        open={licenseSettingsOpen}
        onOpenChange={setLicenseSettingsOpen}
      />
    </div>
  );
}
