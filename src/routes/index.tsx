import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";
import { ConnectionDialog } from "@/components/connection-dialog";
import { EditConnectionDialog } from "@/components/edit-connection-dialog";
import { TableViewer } from "@/components/table-viewer";
import { QueryEditor } from "@/components/query-editor";
import { AIChat } from "@/components/ai-chat";
import { WelcomeScreen } from "@/components/welcome-screen";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { StatusBar } from "@/components/status-bar";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import type { SavedConnection } from "@/lib/types";
import {
  Bot,
  X,
  PanelRightClose,
  PanelRight,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const navigate = useNavigate();
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editConnectionDialogOpen, setEditConnectionDialogOpen] =
    useState(false);
  const [connectionToEdit, setConnectionToEdit] =
    useState<SavedConnection | null>(null);
  const [passwordPromptConnection, setPasswordPromptConnection] =
    useState<SavedConnection | null>(null);
  const connection = useConnectionStore((s) => s.connection);

  // Active tab from store for cross-component navigation
  const activeTab = useAIQueryStore((s) => s.activeTab);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);

  // AI Panel state
  const aiPanelOpen = useAIQueryStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useAIQueryStore((s) => s.setAiPanelOpen);
  const toggleAiPanel = useAIQueryStore((s) => s.toggleAiPanel);

  // Sidebar state
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAIQueryStore((s) => s.toggleSidebar);

  // Status bar visibility
  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);

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

      if (
        modifier &&
        e.altKey &&
        (e.key === "b" || e.key === "B" || e.keyCode === 66)
      ) {
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

  // Global keyboard shortcuts and menu event handling
  const { refreshAll } = useGlobalShortcuts({
    onNewConnection: () => setConnectionDialogOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
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
    setConnectionToEdit(savedConnection);
    setEditConnectionDialogOpen(true);
  };

  if (!connection) {
    return (
      <>
        <WelcomeScreen
          onNewConnection={() => setConnectionDialogOpen(true)}
          onSelectConnection={handleSelectSavedConnection}
          onEditConnection={handleEditConnection}
        />
        <ConnectionDialog
          open={connectionDialogOpen}
          onOpenChange={setConnectionDialogOpen}
        />
        <EditConnectionDialog
          connection={connectionToEdit}
          open={editConnectionDialogOpen}
          onOpenChange={setEditConnectionDialogOpen}
        />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onSelectConnection={handleSelectSavedConnection}
          onEditConnection={handleEditConnection}
          onNewConnection={() => setConnectionDialogOpen(true)}
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
      {/* Titlebar drag region - empty div for window dragging */}
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0 bg-background"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main tabs area */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex h-full flex-col"
            >
              <div className="flex h-10 items-center justify-between border-b border-border px-2">
                <div className="flex items-center">
                  {/* Sidebar Toggle Button */}
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

                  <div className="mx-2 h-4 w-px bg-border" />

                  <TabsList className="h-10 gap-1 bg-transparent p-0">
                    <TabsTrigger
                      value="data"
                      className="h-7 rounded-md border-0 bg-transparent px-3 text-sm text-muted-foreground shadow-none data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Data
                    </TabsTrigger>
                    <TabsTrigger
                      value="query"
                      className="h-7 rounded-md border-0 bg-transparent px-3 text-sm text-muted-foreground shadow-none data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Query
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex items-center gap-1">
                  {/* Settings Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate({ to: "/settings" })}
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  {/* AI Panel Toggle Button */}
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

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-hidden"
                >
                  {activeTab === "data" && (
                    <TabsContent
                      value="data"
                      className="mt-0 h-full"
                      forceMount
                    >
                      <TableViewer />
                    </TabsContent>
                  )}
                  {activeTab === "query" && (
                    <TabsContent
                      value="query"
                      className="mt-0 h-full"
                      forceMount
                    >
                      <QueryEditor />
                    </TabsContent>
                  )}
                </motion.div>
              </AnimatePresence>
            </Tabs>
          </main>

          {/* AI Panel - Right Side - Always mounted to preserve state */}
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
              {/* Resize Handle */}
              <div
                onMouseDown={handleResizeStart}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/40 z-10 -ml-1"
              />

              {/* AI Panel Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Querybuddy</span>
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌥⌘</span>B
                  </kbd>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAiPanelOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden">
                <AIChat />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {statusBarVisible && <StatusBar />}

      <ConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
      />
      <EditConnectionDialog
        connection={connectionToEdit}
        open={editConnectionDialogOpen}
        onOpenChange={setEditConnectionDialogOpen}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={() => setConnectionDialogOpen(true)}
        onRefresh={refreshAll}
      />
      <PasswordPromptDialog
        connection={passwordPromptConnection}
        open={passwordPromptConnection !== null}
        onOpenChange={(open) => !open && setPasswordPromptConnection(null)}
      />
    </div>
  );
}
