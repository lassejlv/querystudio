import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";

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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/db/$connectionId")({
  component: DatabaseStudio,
});

function DatabaseStudio() {
  const navigate = useNavigate();
  const { connectionId } = useParams({ from: "/db/$connectionId" });

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const connection = useConnectionStore((s) => s.connection);
  const { data: savedConnections, isLoading: isLoadingSaved } = useSavedConnections();
  const connect = useConnect();
  const reconnectAttempted = useRef(false);

  // AI Panel state
  const aiPanelOpen = useAIQueryStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);
  const toggleAiPanel = useAIQueryStore((s) => s.toggleAiPanel);

  // Sidebar state
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAIQueryStore((s) => s.toggleSidebar);

  // Status bar visibility
  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);

  // Experimental terminal
  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);

  // Debug mode
  const debugMode = useAIQueryStore((s) => s.debugMode);

  // AI Panel width (resizable)
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem("querystudio_ai_panel_width");
    return saved ? parseInt(saved, 10) : 420;
  });
  const [isResizing, setIsResizing] = useState(false);
  const minWidth = 320;
  const maxWidth = 800;

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("querystudio_ai_panel_width", String(aiPanelWidth));
  }, [aiPanelWidth]);

  // Handle resize drag
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

  // Keyboard shortcut for AI panel (Cmd+Option+B / Ctrl+Alt+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Option+Cmd+B on Mac (keyCode 66 = B), Ctrl+Alt+B on Windows/Linux - Toggle AI Panel
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.altKey && (e.key === "b" || e.key === "B" || e.keyCode === 66)) {
        e.preventDefault();
        e.stopPropagation();
        toggleAiPanel();
        return;
      }

      // Cmd+B on Mac, Ctrl+B on Windows/Linux - Toggle Sidebar
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

      // Escape to close AI panel
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

  // Global keyboard shortcuts and menu event handling
  const { refreshAll } = useGlobalShortcuts({
    onNewConnection: handleNewConnection,
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onOpenSettings: () => {
      navigate({ to: "/settings" });
    },
  });

  const handleSelectSavedConnection = (savedConnection: SavedConnection) => {
    // If it's a connection string, it has the password embedded, so connect directly
    if ("connection_string" in savedConnection.config) {
      setPasswordPromptConnection(savedConnection);
    } else {
      // Need password for params-based connections
      setPasswordPromptConnection(savedConnection);
    }
  };

  const handleEditConnection = (savedConnection: SavedConnection) => {
    navigate({
      to: "/edit-connection/$connectionId",
      params: { connectionId: savedConnection.id },
    });
  };

  // Auto-reconnect on page reload if connection is not active
  useEffect(() => {
    if (connection?.id === connectionId) return; // Already connected
    if (isLoadingSaved) return; // Still loading saved connections
    if (reconnectAttempted.current) return; // Already tried

    reconnectAttempted.current = true;

    const savedConnection = savedConnections?.find((c) => c.id === connectionId);
    if (!savedConnection) {
      // No saved connection found, redirect to home
      navigate({ to: "/" });
      return;
    }

    // Try to auto-connect
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
            password: "", // Will prompt if needed
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
        navigate({ to: "/" });
      })
      .finally(() => {
        setIsReconnecting(false);
      });
  }, [connection, connectionId, isLoadingSaved, savedConnections, connect, navigate]);

  // Show loading state while reconnecting
  if (isReconnecting) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        {/* Titlebar with drag region */}
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

  // If no connection or connection ID doesn't match, show error
  if (!connection || connection.id !== connectionId) {
    return (
      <>
        <div className="flex h-screen flex-col bg-background text-foreground">
          {/* Titlebar with drag region */}
          <div
            data-tauri-drag-region
            className="h-8 w-full shrink-0"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No active connection</p>
              <Button onClick={() => navigate({ to: "/" })}>Go to Connections</Button>
            </div>
          </div>
        </div>
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
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Titlebar with drag region and controls */}
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

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden h-full">
              <PaneContainer connectionId={connectionId} dbType={connection?.db_type} />
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
