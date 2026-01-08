import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/sidebar";
import { ConnectionDialog } from "@/components/connection-dialog";
import { TableViewer } from "@/components/table-viewer";
import { QueryEditor } from "@/components/query-editor";
import { AIChat } from "@/components/ai-chat";
import { WelcomeScreen } from "@/components/welcome-screen";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import type { SavedConnection } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(null);
  const connection = useConnectionStore((s) => s.connection);
  
  // Active tab from store for cross-component navigation
  const activeTab = useAIQueryStore((s) => s.activeTab);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);
  
  // Global keyboard shortcuts and menu event handling
  const { refreshAll } = useGlobalShortcuts({
    onNewConnection: () => setConnectionDialogOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenSettings: () => {
      // Open AI tab where settings are accessible
      setActiveTab("ai");
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

  if (!connection) {
    return (
      <>
        <WelcomeScreen
          onNewConnection={() => setConnectionDialogOpen(true)}
          onSelectConnection={handleSelectSavedConnection}
        />
        <ConnectionDialog
          open={connectionDialogOpen}
          onOpenChange={setConnectionDialogOpen}
        />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onSelectConnection={handleSelectSavedConnection}
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
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
            <div className="border-b border-border px-4">
              <TabsList className="h-12 bg-transparent">
                <TabsTrigger
                  value="data"
                  className="data-[state=active]:bg-secondary transition-all duration-200"
                >
                  Table Data
                </TabsTrigger>
                <TabsTrigger
                  value="query"
                  className="data-[state=active]:bg-secondary transition-all duration-200"
                >
                  Query
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="data-[state=active]:bg-secondary transition-all duration-200"
                >
                  AI Assistant
                </TabsTrigger>
              </TabsList>
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
                  <TabsContent value="data" className="mt-0 h-full" forceMount>
                    <TableViewer />
                  </TabsContent>
                )}
                {activeTab === "query" && (
                  <TabsContent value="query" className="mt-0 h-full" forceMount>
                    <QueryEditor />
                  </TabsContent>
                )}
                {activeTab === "ai" && (
                  <TabsContent value="ai" className="mt-0 h-full" forceMount>
                    <AIChat />
                  </TabsContent>
                )}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </main>
      </div>

      <ConnectionDialog
        open={connectionDialogOpen}
        onOpenChange={setConnectionDialogOpen}
      />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
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
