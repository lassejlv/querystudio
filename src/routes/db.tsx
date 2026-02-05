import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { ConnectionTabs } from "@/components/connection-tabs";
import { ConnectionPalette } from "@/components/connection-palette";
import { AIChat } from "@/components/ai-chat";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { StatusBar } from "@/components/status-bar";
import { TerminalPanel } from "@/components/terminal-panel";
import { PaneContainer } from "@/components/pane-container";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useSavedConnections, useConnect } from "@/lib/hooks";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import type { SavedConnection } from "@/lib/types";
import { FpsCounter } from "@/components/fps-counter";
import {
  PanelRightClose,
  PanelRight,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/db")({
  component: DatabaseStudio,
});

function DatabaseStudio() {
  const navigate = useNavigate();

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [connectionPaletteOpen, setConnectionPaletteOpen] = useState(false);
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const [isReconnecting, setIsReconnecting] = useState(false);

  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);

  const { data: savedConnections, isLoading: isLoadingSaved } = useSavedConnections();
  const connect = useConnect();
  const reconnectAttempted = useRef(false);

  const aiPanelOpen = useAIQueryStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);
  const aiPanelWidth = useAIQueryStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useAIQueryStore((s) => s.setAiPanelWidth);
  const toggleAiPanel = useAIQueryStore((s) => s.toggleAiPanel);

  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAIQueryStore((s) => s.toggleSidebar);

  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);

  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);
  const multiConnectionsEnabled = useAIQueryStore((s) => s.multiConnectionsEnabled);

  const debugMode = useAIQueryStore((s) => s.debugMode);

  const [isResizing, setIsResizing] = useState(false);
  const minWidth = 320;
  const maxWidth = 800;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      setAiPanelWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.altKey && (e.key === "b" || e.key === "B" || e.keyCode === 66)) {
        e.preventDefault();
        e.stopPropagation();
        toggleAiPanel();
        return;
      }

      if (
        modifier &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === "b" || e.key === "B" || e.keyCode === 66)
      ) {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
        return;
      }

      if (e.key === "Escape" && aiPanelOpen) {
        setAiPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aiPanelOpen, toggleAiPanel, setAiPanelOpen, toggleSidebar]);

  const handleNewConnection = () => {
    navigate({ to: "/new-connection" });
  };

  const { refreshAll } = useGlobalShortcuts({
    onNewConnection: handleNewConnection,
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenSettings: () => {
      navigate({ to: "/settings" });
    },
  });

  const handleSelectSavedConnection = (savedConnection: SavedConnection) => {
    setPasswordPromptConnection(savedConnection);
  };

  const handleEditConnection = (savedConnection: SavedConnection) => {
    navigate({
      to: "/edit-connection/$connectionId",
      params: { connectionId: savedConnection.id },
    });
  };

  // Auto-reconnect to last active connection on page reload
  useEffect(() => {
    if (activeConnections.length > 0) return;
    if (isLoadingSaved) return;
    if (reconnectAttempted.current) return;

    reconnectAttempted.current = true;

    const lastConnectionId = localStorage.getItem("querystudio_last_connection");
    if (!lastConnectionId) return;

    const savedConnection = savedConnections?.find((c) => c.id === lastConnectionId);
    if (!savedConnection) return;

    setIsReconnecting(true);
    const config =
      "connection_string" in savedConnection.config
        ? {
            db_type: savedConnection.db_type || "postgres",
            connection_string: savedConnection.config.connection_string,
          }
        : {
            db_type: savedConnection.db_type || "postgres",
            ...savedConnection.config,
            password: "",
          };

    connect
      .mutateAsync({
        id: savedConnection.id,
        name: savedConnection.name,
        db_type: savedConnection.db_type || "postgres",
        config,
      })
      .then(() => {
        toast.success("Reconnected successfully");
      })
      .catch((error) => {
        toast.error(`Failed to reconnect: ${error}`);
      })
      .finally(() => {
        setIsReconnecting(false);
      });
  }, [activeConnections.length, isLoadingSaved, savedConnections, connect]);

  if (isReconnecting) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        <div
          data-tauri-drag-region
          className="h-8 w-full shrink-0"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Reconnecting...</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (activeConnections.length === 0 && !isReconnecting) {
      navigate({ to: "/" });
    }
  }, [activeConnections.length, isReconnecting, navigate]);

  const activeConnection = activeConnections.find((c) => c.id === activeConnectionId);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div
        className="h-8 w-full shrink-0 flex items-center justify-between"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div
          className="flex items-center h-full pl-[70px]"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            title="Toggle sidebar (⌘B)"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div
          className="flex items-center h-full gap-1 pr-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {!multiConnectionsEnabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setConnectionPaletteOpen(true)}
              title="Switch connection"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/settings" })}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={toggleAiPanel}
            title="Toggle Querybuddy (⌥⌘B)"
          >
            {aiPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {multiConnectionsEnabled && (
        <ConnectionTabs onAddConnection={() => setConnectionPaletteOpen(true)} />
      )}

      <ConnectionPalette
        open={connectionPaletteOpen}
        onOpenChange={setConnectionPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
      />

      <div className="flex flex-1 overflow-hidden">
        {activeConnection && <Sidebar />}

        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden h-full">
              {activeConnection ? (
                <PaneContainer
                  connectionId={activeConnection.id}
                  dbType={activeConnection.db_type}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select a connection
                </div>
              )}
            </div>
          </main>

          <div
            className="relative shrink-0 overflow-hidden"
            style={{
              width: aiPanelOpen ? aiPanelWidth : 0,
              transition: isResizing ? "none" : "width 0.2s ease-in-out",
            }}
          >
            <aside
              className="absolute inset-y-0 right-0 flex flex-col border-l border-border bg-background"
              style={{ width: aiPanelWidth }}
            >
              <div
                onMouseDown={handleResizeStart}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/40 z-10 -ml-1"
              />

              <div className="flex-1 overflow-hidden">
                <AIChat />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {experimentalTerminal && <TerminalPanel />}

      {statusBarVisible && <StatusBar />}

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={handleNewConnection}
        onRefresh={refreshAll}
      />
      <PasswordPromptDialog
        connection={passwordPromptConnection}
        open={passwordPromptConnection !== null}
        onOpenChange={(open) => !open && setPasswordPromptConnection(null)}
      />
      {debugMode && <FpsCounter />}
    </div>
  );
}
