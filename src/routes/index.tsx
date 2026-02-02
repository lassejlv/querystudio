import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const activeConnections = useConnectionStore((s) => s.activeConnections);

  // If there are active connections, redirect to the database studio
  useEffect(() => {
    if (activeConnections.length > 0) {
      navigate({ to: "/db" });
    }
  }, [activeConnections, navigate]);

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
    if ("connection_string" in savedConnection.config) {
      setPasswordPromptConnection(savedConnection);
    } else {
      setPasswordPromptConnection(savedConnection);
    }
  };

  const handleEditConnection = (savedConnection: SavedConnection) => {
    navigate({
      to: "/edit-connection/$connectionId",
      params: { connectionId: savedConnection.id },
    });
  };

  return (
    <>
      <WelcomeScreen
        onNewConnection={handleNewConnection}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
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
