import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { EditConnectionDialog } from "@/components/edit-connection-dialog";
import { WelcomeScreen } from "@/components/welcome-screen";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { useConnectionStore } from "@/lib/store";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import type { SavedConnection } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editConnectionDialogOpen, setEditConnectionDialogOpen] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState<SavedConnection | null>(null);
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const connection = useConnectionStore((s) => s.connection);

  // If there's an active connection, redirect to the database studio
  useEffect(() => {
    if (connection) {
      navigate({ to: "/db/$connectionId", params: { connectionId: connection.id } });
    }
  }, [connection, navigate]);

  const handleNewConnection = () => {
    navigate({ to: "/new-connection" });
  };

  // Global keyboard shortcuts and menu event handling
  const { refreshAll } = useGlobalShortcuts({
    onNewConnection: handleNewConnection,
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

  return (
    <>
      <WelcomeScreen
        onNewConnection={handleNewConnection}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
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
