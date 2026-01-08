import { useEffect, useState } from "react";
import { Database, Plus, Trash2, RefreshCw, LayoutGrid, Terminal, Sparkles, LogOut, Moon, Sparkle } from "lucide-react";
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
import { useSavedConnections, useDeleteSavedConnection, useDisconnect } from "@/lib/hooks";
import { useConnectionStore, useAIQueryStore, useThemeStore } from "@/lib/store";
import type { SavedConnection } from "@/lib/types";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConnection: (connection: SavedConnection) => void;
  onNewConnection: () => void;
  onRefresh?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelectConnection,
  onNewConnection,
  onRefresh,
}: CommandPaletteProps) {
  const { data: savedConnections } = useSavedConnections();
  const deleteConnection = useDeleteSavedConnection();
  const disconnect = useDisconnect();
  const connection = useConnectionStore((s) => s.connection);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);
  const { theme, setTheme } = useThemeStore();
  const [search, setSearch] = useState("");

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

  const getConnectionDescription = (connection: SavedConnection) => {
    if ("connection_string" in connection.config) {
      return "Connection string";
    }
    return `${connection.config.host}:${connection.config.port}/${connection.config.database}`;
  };

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
              <CommandItem onSelect={() => { onRefresh?.(); onOpenChange(false); }}>
                <RefreshCw className="h-4 w-4" />
                <span>Refresh Data</span>
                <CommandShortcut>⌘R</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveTab("data"); onOpenChange(false); }}>
                <LayoutGrid className="h-4 w-4" />
                <span>Go to Table Data</span>
                <CommandShortcut>⌘1</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveTab("query"); onOpenChange(false); }}>
                <Terminal className="h-4 w-4" />
                <span>Go to Query Editor</span>
                <CommandShortcut>⌘2</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveTab("ai"); onOpenChange(false); }}>
                <Sparkles className="h-4 w-4" />
                <span>Go to AI Assistant</span>
                <CommandShortcut>⌘3</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { disconnect.mutate(); onOpenChange(false); }}>
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
                  onClick={(e) => handleDelete(e, conn.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleNewConnection}>
            <Plus className="h-4 w-4" />
            <span>New Connection</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem 
            onSelect={() => { setTheme("dark"); onOpenChange(false); }}
            className={theme === "dark" ? "bg-accent" : ""}
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
            {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </CommandItem>
          <CommandItem 
            onSelect={() => { setTheme("tokyo-night"); onOpenChange(false); }}
            className={theme === "tokyo-night" ? "bg-accent" : ""}
          >
            <Sparkle className="h-4 w-4" />
            <span>Tokyo Night</span>
            {theme === "tokyo-night" && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
