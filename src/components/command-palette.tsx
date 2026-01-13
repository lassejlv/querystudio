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
import { useThemeStore } from "@/lib/theme-store";
import type { SavedConnection } from "@/lib/types";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { getVersion } from "@tauri-apps/api/app";

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
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);
  const { getAllThemes, setActiveTheme, activeTheme } = useThemeStore();
  const [search, setSearch] = useState("");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const { canSave, maxSaved } = useCanSaveConnection();
  const { checking, checkForUpdates } = useUpdateChecker();

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
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = (connection: SavedConnection) => {
    onOpenChange(false);
    setSearch("");
    onSelectConnection(connection);
  };

  const handleNewConnection = () => {
    onOpenChange(false);
    setSearch("");
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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search commands..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

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
                  setActiveTab("data");
                  onOpenChange(false);
                }}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>Go to Table Data</span>
                <CommandShortcut>⌘1</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setActiveTab("query");
                  onOpenChange(false);
                }}
              >
                <Terminal className="h-4 w-4" />
                <span>Go to Query Editor</span>
                <CommandShortcut>⌘2</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setActiveTab("ai");
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

        <CommandGroup heading="Themes">
          {themes.map((theme) => (
            <CommandItem
              key={theme.id}
              value={`theme ${theme.displayName || theme.name}`}
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

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={handleNewConnection}
            disabled={!canSave}
            className={!canSave ? "opacity-50" : ""}
          >
            {canSave ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            <span>New Connection</span>
            {!canSave && (
              <span className="text-xs text-muted-foreground ml-auto">
                Limit: {maxSaved}
              </span>
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
          {appVersion && (
            <CommandItem disabled className="opacity-70">
              <Info className="h-4 w-4" />
              <span>Version {appVersion}</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}