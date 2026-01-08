import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useConnectionStore, useAIQueryStore } from "./store";
import { useDisconnect } from "./hooks";

interface GlobalShortcutsOptions {
  onOpenCommandPalette?: () => void;
  onNewConnection?: () => void;
  onOpenSettings?: () => void;
}

export function useGlobalShortcuts(options: GlobalShortcutsOptions = {}) {
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);
  const disconnect = useDisconnect();

  // Refresh all data for current connection
  const refreshAll = () => {
    if (!connection) return;
    
    // Invalidate tables list
    queryClient.invalidateQueries({ queryKey: ["tables", connection.id] });
    
    // Invalidate all columns (for autocomplete)
    queryClient.invalidateQueries({ queryKey: ["allColumns", connection.id] });
    
    // Invalidate current table data if a table is selected
    if (selectedTable) {
      queryClient.invalidateQueries({ 
        queryKey: ["tableData", connection.id, selectedTable.schema, selectedTable.name] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["tableCount", connection.id, selectedTable.schema, selectedTable.name] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["columns", connection.id, selectedTable.schema, selectedTable.name] 
      });
    }
  };

  // Listen for menu events from Tauri
  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new_connection":
          options.onNewConnection?.();
          break;
        case "disconnect":
          if (connection) {
            disconnect.mutate();
          }
          break;
        case "settings":
          options.onOpenSettings?.();
          break;
        case "view_data":
          setActiveTab("data");
          break;
        case "view_query":
          setActiveTab("query");
          break;
        case "view_ai":
          setActiveTab("ai");
          break;
        case "refresh":
          refreshAll();
          break;
        case "command_palette":
          options.onOpenCommandPalette?.();
          break;
        case "documentation":
          window.open("https://github.com/yourusername/querystudio", "_blank");
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [connection, disconnect, options, setActiveTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      // Cmd+R - Refresh data (prevent browser reload)
      if (isMod && e.key === "r") {
        e.preventDefault();
        refreshAll();
        return;
      }
      
      // Cmd+1/2/3 - Switch tabs
      if (isMod && e.key === "1") {
        e.preventDefault();
        setActiveTab("data");
        return;
      }
      if (isMod && e.key === "2") {
        e.preventDefault();
        setActiveTab("query");
        return;
      }
      if (isMod && e.key === "3") {
        e.preventDefault();
        setActiveTab("ai");
        return;
      }
      
      // Cmd+N - New connection
      if (isMod && e.key === "n") {
        e.preventDefault();
        options.onNewConnection?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connection, selectedTable, setActiveTab, options.onNewConnection]);

  return { refreshAll };
}
