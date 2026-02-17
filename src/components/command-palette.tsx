import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Database,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  LayoutGrid,
  Terminal,
  Sparkles,
  LogOut,
  Lock,
  Download,
  Info,
  Palette,
  Check,
  ArrowLeft,
  ClipboardPaste,
  Loader2,
  Settings,
  RefreshCcwDotIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  useSavedConnections,
  useDeleteSavedConnection,
  useDisconnect,
  useCanSaveConnection,
} from "@/lib/hooks";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useLayoutStore } from "@/lib/layout-store";
import { useThemeStore } from "@/lib/theme-store";
import type { SavedConnection } from "@/lib/types";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { useAuthDeepLink } from "@/hooks/use-auth-deep-link";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { openSettingsWindow } from "@/lib/settings-window";
import { useNavigate } from "@tanstack/react-router";
import { relaunch } from "@tauri-apps/plugin-process";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConnection: (connection: SavedConnection) => void;
  onEditConnection: (connection: SavedConnection) => void;
  onNewConnection: () => void;
  onRefresh?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectConnection,
  onEditConnection,
  onNewConnection,
  onRefresh,
}: CommandPaletteProps) {
  const { data: savedConnections } = useSavedConnections();
  const deleteConnection = useDeleteSavedConnection();
  const disconnect = useDisconnect();
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const getActiveConnection = useConnectionStore((s) => s.getActiveConnection);
  const connection = getActiveConnection();
  const connectionId = activeConnectionId ?? "";
  const getAllLeafPanes = useLayoutStore((s) => s.getAllLeafPanes);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const createTab = useLayoutStore((s) => s.createTab);
  const getActivePane = useLayoutStore((s) => s.getActivePane);
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);
  const { getAllThemes, setActiveTheme, activeTheme } = useThemeStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<"main" | "themes">("main");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const { canSave, maxSaved } = useCanSaveConnection();
  const { checking, checkForUpdates } = useUpdateChecker({ autoCheckOnMount: false });
  const { handleAuthCallback } = useAuthDeepLink({
    enableDeepLinkListener: false,
    enableSessionSync: false,
  });
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const navigate = useNavigate();

  const handlePasteAuthUrl = useCallback(async () => {
    try {
      setIsProcessingAuth(true);
      // Use browser clipboard API (works in Tauri webview)
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        toast.error("Clipboard is empty");
        return;
      }
      // Check if it looks like an auth URL (has token parameter)
      if (clipboardText.includes("token=")) {
        await handleAuthCallback(clipboardText);
      } else {
        toast.error("Clipboard doesn't contain a valid auth URL (no token found)");
      }
    } catch (error) {
      console.error("Failed to read clipboard:", error);
      toast.error("Failed to read clipboard");
    } finally {
      setIsProcessingAuth(false);
    }
  }, [handleAuthCallback]);

  const fetchAppVersion = useCallback(async () => {
    try {
      const version = await getVersion();
      setAppVersion(version);
    } catch (error) {
      console.error("Failed to get app version:", error);
    }
  }, []);

  useEffect(() => {
    if (open && !appVersion) {
      fetchAppVersion();
    }
  }, [open, appVersion, fetchAppVersion]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Handle ESC on themes page to go back instead of closing
      if (e.key === "Escape" && open && page === "themes") {
        e.preventDefault();
        setPage("main");
        setSearch("");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, page]);

  const handleSelect = (connection: SavedConnection) => {
    onOpenChange(false);
    setSearch("");
    setPage("main");
    onSelectConnection(connection);
  };

  const handleNewConnection = () => {
    onOpenChange(false);
    setSearch("");
    setPage("main");
    onNewConnection();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConnection.mutate(id);
  };

  const handleEdit = (e: React.MouseEvent, conn: SavedConnection) => {
    e.stopPropagation();
    onOpenChange(false);
    setSearch("");
    onEditConnection(conn);
  };

  const getConnectionDescription = (connection: SavedConnection) => {
    const dbLabel =
      connection.db_type === "mysql"
        ? "MySQL"
        : connection.db_type === "redis"
          ? "Redis"
          : connection.db_type === "sqlite"
            ? "SQLite"
            : connection.db_type === "mongodb"
              ? "MongoDB"
              : "PostgreSQL";

    if ("connection_string" in connection.config) {
      return `${dbLabel} · Connection string`;
    }
    return `${dbLabel} · ${connection.config.host}:${connection.config.port}/${connection.config.database}`;
  };

  const themes = useMemo(() => getAllThemes(), [getAllThemes]);
  const sortedConnections = useMemo(
    () => [...(savedConnections ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [savedConnections],
  );
  const itemClassName =
    "group rounded-lg border border-transparent px-2.5 py-2 data-[selected=true]:border-border/60 data-[selected=true]:bg-muted/60";
  const iconClassName = "h-4 w-4 text-muted-foreground";

  return (
    <CommandDialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setPage("main");
          setSearch("");
        }
      }}
    >
      <CommandInput
        placeholder="Type a command, connection, or theme..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {page === "themes" ? (
          <>
            <CommandGroup heading="Navigation">
              <CommandItem
                className={itemClassName}
                onSelect={() => {
                  setPage("main");
                  setSearch("");
                }}
              >
                <ArrowLeft className={iconClassName} />
                <span>Back to Commands</span>
                <CommandShortcut>Esc</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Themes">
              {themes.map((theme) => (
                <CommandItem
                  key={theme.id}
                  className={itemClassName}
                  value={theme.displayName || theme.name}
                  onSelect={() => {
                    setActiveTheme(theme.id);
                    // Don't close palette when switching themes so user can try multiple
                  }}
                >
                  <Palette className={iconClassName} />
                  <div className="flex flex-1 items-center justify-between">
                    <span>{theme.displayName || theme.name}</span>
                    {activeTheme === theme.id && <Check className="h-4 w-4" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : (
          <>
            {/* Quick Actions - only when connected */}
            {connection && (
              <>
                <CommandGroup heading="Workspace">
                  <CommandItem
                    className={itemClassName}
                    onSelect={() => {
                      onRefresh?.();
                      onOpenChange(false);
                    }}
                  >
                    <RefreshCw className={iconClassName} />
                    <span>Refresh Data</span>
                    <CommandShortcut>⌘R</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    className={itemClassName}
                    onSelect={() => {
                      if (connectionId) {
                        const leafPanes = getAllLeafPanes(connectionId);
                        for (const pane of leafPanes) {
                          const dataTab = pane.tabs.find((t) => t.type === "data");
                          if (dataTab) {
                            setActiveTab(connectionId, pane.id, dataTab.id);
                            onOpenChange(false);
                            return;
                          }
                        }
                        const activePane = getActivePane(connectionId);
                        if (activePane) {
                          createTab(connectionId, activePane.id, "data", {
                            title: "Data",
                          });
                        }
                      }
                      onOpenChange(false);
                    }}
                  >
                    <LayoutGrid className={iconClassName} />
                    <span>Go to Table Data</span>
                    <CommandShortcut>⌘1</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    className={itemClassName}
                    onSelect={() => {
                      if (connectionId) {
                        const leafPanes = getAllLeafPanes(connectionId);
                        for (const pane of leafPanes) {
                          const queryTab = pane.tabs.find((t) => t.type === "query");
                          if (queryTab) {
                            setActiveTab(connectionId, pane.id, queryTab.id);
                            onOpenChange(false);
                            return;
                          }
                        }
                        const activePane = getActivePane(connectionId);
                        if (activePane) {
                          createTab(connectionId, activePane.id, "query", {
                            title: "Query",
                          });
                        }
                      }
                      onOpenChange(false);
                    }}
                  >
                    <Terminal className={iconClassName} />
                    <span>Go to Query Editor</span>
                    <CommandShortcut>⌘2</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    className={itemClassName}
                    onSelect={() => {
                      setAiPanelOpen(true);
                      onOpenChange(false);
                    }}
                  >
                    <Sparkles className={iconClassName} />
                    <span>Go to Querybuddy</span>
                    <CommandShortcut>⌘3</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    className={itemClassName}
                    onSelect={() => {
                      disconnect.mutate(undefined);
                      onOpenChange(false);
                    }}
                  >
                    <LogOut className={iconClassName} />
                    <span>Disconnect</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {sortedConnections.length > 0 && (
              <CommandGroup heading="Connections">
                {sortedConnections.map((conn) => (
                  <CommandItem
                    key={conn.id}
                    className={itemClassName}
                    value={`${conn.name} ${getConnectionDescription(conn)}`}
                    onSelect={() => handleSelect(conn)}
                  >
                    <Database className={iconClassName} />
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{conn.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {getConnectionDescription(conn)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleEdit(e, conn)}
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-secondary/70 group-hover:opacity-100"
                      title="Edit connection"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, conn.id)}
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-secondary/70 group-hover:opacity-100"
                      title="Delete connection"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem
                className={itemClassName}
                onSelect={() => {
                  setPage("themes");
                  setSearch("");
                }}
              >
                <Palette className={iconClassName} />
                <span>Choose Theme</span>
              </CommandItem>
              <CommandItem
                onSelect={handleNewConnection}
                disabled={!canSave}
                className={cn(itemClassName, !canSave && "opacity-50")}
              >
                {canSave ? <Plus className={iconClassName} /> : <Lock className={iconClassName} />}
                <span>New Connection</span>
                {!canSave && (
                  <span className="text-xs text-muted-foreground ml-auto">Limit: {maxSaved}</span>
                )}
                {canSave && <CommandShortcut>⌘N</CommandShortcut>}
              </CommandItem>
              <CommandItem
                className={itemClassName}
                onSelect={() => {
                  checkForUpdates(false);
                  onOpenChange(false);
                }}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Download className={iconClassName} />
                )}
                <span>{checking ? "Checking..." : "Check for Updates"}</span>
              </CommandItem>
              <CommandItem
                className={itemClassName}
                onSelect={async () => {
                  await handlePasteAuthUrl();
                  onOpenChange(false);
                }}
                disabled={isProcessingAuth}
              >
                {isProcessingAuth ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ClipboardPaste className={iconClassName} />
                )}
                <span>{isProcessingAuth ? "Processing..." : "Paste Auth URL"}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  void openSettingsWindow({ fallback: () => navigate({ to: "/settings" }) });
                }}
              >
                <Settings /> Settings
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  void relaunch();
                }}
              >
                Reload Workspace
              </CommandItem>
              <CommandItem disabled className={cn(itemClassName, "opacity-70")}>
                <Info className={iconClassName} />
                <span>{appVersion ? `Version ${appVersion}` : "Version ..."}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
