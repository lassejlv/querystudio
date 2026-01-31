import { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";

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
  const connection = useConnectionStore((s) => s.connection);
  const connectionId = connection?.id ?? "";
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
  const { checking, checkForUpdates } = useUpdateChecker();
  const { handleAuthCallback } = useAuthDeepLink();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

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
    if ("connection_string" in connection.config) {
      return "Connection string";
    }
    return `${connection.config.host}:${connection.config.port}/${connection.config.database}`;
  };

  const themes = getAllThemes();

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
      <CommandInput placeholder="Search commands..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {page === "themes" ? (
          <>
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => {
                  setPage("main");
                  setSearch("");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Commands</span>
                <CommandShortcut>Esc</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Themes">
              {themes.map((theme) => (
                <CommandItem
                  key={theme.id}
                  value={theme.displayName || theme.name}
                  onSelect={() => {
                    setActiveTheme(theme.id);
                    // Don't close palette when switching themes so user can try multiple
                  }}
                >
                  <Palette className="h-4 w-4" />
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
                <CommandGroup heading="Quick Actions">
                  <CommandItem
                    onSelect={() => {
                      onRefresh?.();
                      onOpenChange(false);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh Data</span>
                    <CommandShortcut>⌘R</CommandShortcut>
                  </CommandItem>
                  <CommandItem
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
                    <LayoutGrid className="h-4 w-4" />
                    <span>Go to Table Data</span>
                    <CommandShortcut>⌘1</CommandShortcut>
                  </CommandItem>
                  <CommandItem
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
                    <Terminal className="h-4 w-4" />
                    <span>Go to Query Editor</span>
                    <CommandShortcut>⌘2</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setAiPanelOpen(true);
                      onOpenChange(false);
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Go to Querybuddy</span>
                    <CommandShortcut>⌘3</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      disconnect.mutate();
                      onOpenChange(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Disconnect</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {savedConnections && savedConnections.length > 0 && (
              <CommandGroup heading="Saved Connections">
                {savedConnections.map((conn) => (
                  <CommandItem
                    key={conn.id}
                    value={conn.name}
                    onSelect={() => handleSelect(conn)}
                    className="group"
                  >
                    <Database className="h-4 w-4" />
                    <div className="flex flex-1 flex-col">
                      <span>{conn.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {getConnectionDescription(conn)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleEdit(e, conn)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded"
                      title="Edit connection"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, conn.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded"
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
                onSelect={() => {
                  setPage("themes");
                  setSearch("");
                }}
              >
                <Palette className="h-4 w-4" />
                <span>Choose Theme</span>
              </CommandItem>
              <CommandItem
                onSelect={handleNewConnection}
                disabled={!canSave}
                className={!canSave ? "opacity-50" : ""}
              >
                {canSave ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span>New Connection</span>
                {!canSave && (
                  <span className="text-xs text-muted-foreground ml-auto">Limit: {maxSaved}</span>
                )}
                {canSave && <CommandShortcut>⌘N</CommandShortcut>}
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  checkForUpdates(false);
                  onOpenChange(false);
                }}
                disabled={checking}
              >
                <Download className="h-4 w-4" />
                <span>{checking ? "Checking..." : "Check for Updates"}</span>
              </CommandItem>
              <CommandItem
                onSelect={async () => {
                  await handlePasteAuthUrl();
                  onOpenChange(false);
                }}
                disabled={isProcessingAuth}
              >
                <ClipboardPaste className="h-4 w-4" />
                <span>{isProcessingAuth ? "Processing..." : "Paste Auth URL (Dev)"}</span>
              </CommandItem>
              <CommandItem disabled className="opacity-70">
                <Info className="h-4 w-4" />
                <span>{appVersion ? `Version ${appVersion}` : "Version ..."}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
