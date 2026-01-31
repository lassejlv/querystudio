import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useConnectionStore, useAIQueryStore } from "./store";
import { useLayoutStore } from "./layout-store";
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
  const connectionId = connection?.id ?? "";

  // Layout store for multi-pane/tab support
  const getAllLeafPanes = useLayoutStore((s) => s.getAllLeafPanes);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const createTab = useLayoutStore((s) => s.createTab);
  const getActivePane = useLayoutStore((s) => s.getActivePane);

  // AI panel control
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);

  const disconnect = useDisconnect();

  // Experimental terminal setting
  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);

  // Helper to switch to or create a tab of a specific type
  const switchToTabType = (type: "data" | "query" | "terminal") => {
    if (!connectionId) return;
    const leafPanes = getAllLeafPanes(connectionId);
    // Find existing tab of this type in any pane
    for (const pane of leafPanes) {
      const existingTab = pane.tabs.find((t) => t.type === type);
      if (existingTab) {
        setActiveTab(connectionId, pane.id, existingTab.id);
        return;
      }
    }
    // No existing tab found, create one in active pane
    const activePane = getActivePane(connectionId);
    if (activePane) {
      createTab(connectionId, activePane.id, type, {
        title: type === "data" ? "Data" : type === "query" ? "Query" : "Terminal",
      });
    }
  };

  // Helper to create a new terminal tab
  const createTerminalTab = () => {
    if (!connectionId || !experimentalTerminal) return;
    const activePane = getActivePane(connectionId);
    if (activePane) {
      createTab(connectionId, activePane.id, "terminal", {
        makeActive: true,
      });
    }
  };

  const refreshAll = () => {
    if (!connection) return;

    queryClient.invalidateQueries({ queryKey: ["tables", connection.id] });

    queryClient.invalidateQueries({ queryKey: ["allColumns", connection.id] });

    if (selectedTable) {
      queryClient.invalidateQueries({
        queryKey: ["tableData", connection.id, selectedTable.schema, selectedTable.name],
      });
      queryClient.invalidateQueries({
        queryKey: ["tableCount", connection.id, selectedTable.schema, selectedTable.name],
      });
      queryClient.invalidateQueries({
        queryKey: ["columns", connection.id, selectedTable.schema, selectedTable.name],
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
          switchToTabType("data");
          break;
        case "view_query":
          switchToTabType("query");
          break;
        case "view_ai":
          setAiPanelOpen(true);
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
  }, [
    connection,
    connectionId,
    disconnect,
    options,
    getAllLeafPanes,
    setActiveTab,
    createTab,
    getActivePane,
    setAiPanelOpen,
  ]);

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
        switchToTabType("data");
        return;
      }
      if (isMod && e.key === "2") {
        e.preventDefault();
        switchToTabType("query");
        return;
      }
      if (isMod && e.key === "3") {
        e.preventDefault();
        setAiPanelOpen(true);
        return;
      }

      // Cmd+` - New terminal tab (when experimental terminal is enabled)
      if (isMod && e.key === "`" && experimentalTerminal) {
        e.preventDefault();
        createTerminalTab();
        return;
      }

      // Cmd+N - New connection
      if (isMod && e.key === "n") {
        e.preventDefault();
        options.onNewConnection?.();
        return;
      }

      // Cmd+K - Open command palette
      if (isMod && e.key === "k") {
        e.preventDefault();
        options.onOpenCommandPalette?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    connection,
    connectionId,
    selectedTable,
    getAllLeafPanes,
    setActiveTab,
    createTab,
    getActivePane,
    setAiPanelOpen,
    experimentalTerminal,
    options.onNewConnection,
  ]);

  return { refreshAll };
}
