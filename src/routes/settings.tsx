import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, LogOut, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAIQueryStore } from "@/lib/store";
import { ThemeSelector } from "@/components/theme-selector";
import { toast } from "sonner";
import { authClient, signInWithGithub } from "@/lib/auth-client";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import type { SavedConnection } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SettingsTab = "general" | "account" | "appearance" | "experimental";

function SettingsPage() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const experimentalPlugins = useAIQueryStore((s) => s.experimentalPlugins);

  // Global keyboard shortcuts
  useGlobalShortcuts({
    onNewConnection: () => {
      navigate({ to: "/new-connection" });
    },
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenSettings: () => {
      // Already on settings page
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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "account", label: "Account" },
    { id: "appearance", label: "Appearance" },
    ...(experimentalPlugins ? [{ id: "experimental" as SettingsTab, label: "Experimental" }] : []),
  ];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Titlebar drag region */}
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-56 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => navigate({ to: "/" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Settings Content */}
        <main className="flex-1 overflow-auto p-8 flex justify-center">
          <div className="max-w-xl w-full">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "account" && <AccountSettings />}
            {activeTab === "appearance" && <AppearanceSettings />}
            {activeTab === "experimental" && <ExperimentalSettings />}
          </div>
        </main>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={() => navigate({ to: "/new-connection" })}
      />
      <PasswordPromptDialog
        connection={passwordPromptConnection}
        open={passwordPromptConnection !== null}
        onOpenChange={(open) => !open && setPasswordPromptConnection(null)}
      />
    </div>
  );
}

function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignInWithGithub = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGithub();
      // The session will be refreshed via deep-link callback
    } catch (error) {
      console.error("GitHub sign in error:", error);
      toast.error("Failed to sign in with GitHub");
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>
      <Separator />

      {session ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session.user.image || ""} />
              <AvatarFallback>
                {session.user.name?.charAt(0) || session.user.email.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h3 className="font-semibold text-lg">{session.user.name}</h3>

              <Button variant="link" asChild>
                <a href="https://querystudio.dev/dashboard">
                  Manage Account <ExternalLink />
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Session</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Sign Out</Label>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <Button variant="destructive" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="text-lg font-medium">Not Signed In</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">
              Sign in to sync your preferences and access premium features.
            </p>
            <Button onClick={handleSignInWithGithub} disabled={isSigningIn}>
              {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSigningIn ? "Signing in..." : "Login with your account"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralSettings() {
  const autoReconnect = useAIQueryStore((s) => s.autoReconnect);
  const setAutoReconnect = useAIQueryStore((s) => s.setAutoReconnect);
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAIQueryStore((s) => s.setSidebarCollapsed);
  const debugMode = useAIQueryStore((s) => s.debugMode);
  const setDebugMode = useAIQueryStore((s) => s.setDebugMode);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General</h2>
        <p className="text-muted-foreground">Manage general behavior and application settings.</p>
      </div>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Startup</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Auto-reconnect</Label>
            <p className="text-sm text-muted-foreground">
              Automatically connect to the last used database when the application starts
            </p>
          </div>
          <Switch checked={autoReconnect} onCheckedChange={setAutoReconnect} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Interface</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Collapse Sidebar</Label>
            <p className="text-sm text-muted-foreground">
              Start with the sidebar collapsed to show only icons
            </p>
          </div>
          <Switch checked={sidebarCollapsed} onCheckedChange={setSidebarCollapsed} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Debug</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Debug Mode</Label>
            <p className="text-sm text-muted-foreground">
              Show performance metrics like FPS counter overlay
            </p>
          </div>
          <Switch checked={debugMode} onCheckedChange={setDebugMode} />
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);
  const setStatusBarVisible = useAIQueryStore((s) => s.setStatusBarVisible);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Appearance</h2>
        <p className="text-muted-foreground">Customize the look and feel of the application.</p>
      </div>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Theme</h3>
        <div className="rounded-lg border p-4">
          <ThemeSelector />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Layout Elements</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Status Bar</Label>
            <p className="text-sm text-muted-foreground">
              Show connection status, query times, and cursor position at the bottom
            </p>
          </div>
          <Switch checked={statusBarVisible} onCheckedChange={setStatusBarVisible} />
        </div>
      </div>
    </div>
  );
}

function ExperimentalSettings() {
  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);
  const setExperimentalTerminal = useAIQueryStore((s) => s.setExperimentalTerminal);
  const experimentalPlugins = useAIQueryStore((s) => s.experimentalPlugins);
  const setExperimentalPlugins = useAIQueryStore((s) => s.setExperimentalPlugins);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Experimental</h2>
        <p className="text-muted-foreground">
          Try out experimental features. These features may be unstable or change in future updates.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Features</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Integrated Terminal</Label>
            <p className="text-sm text-muted-foreground">
              Enable an integrated terminal panel for running shell commands directly within the
              application
            </p>
          </div>
          <Switch checked={experimentalTerminal} onCheckedChange={setExperimentalTerminal} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Plugin System</Label>
            <p className="text-sm text-muted-foreground">
              Enable the plugin system to install and manage custom tab plugins. Adds a Plugins tab
              to settings.
            </p>
          </div>
          <Switch checked={experimentalPlugins} onCheckedChange={setExperimentalPlugins} />
        </div>
      </div>

      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Experimental features are provided as-is and may contain bugs or undergo significant
          changes. Use at your own discretion.
        </p>
      </div>
    </div>
  );
}
