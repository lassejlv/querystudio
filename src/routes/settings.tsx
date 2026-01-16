import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Settings,
  Palette,
  Keyboard,
  ArrowLeft,
  FlaskConical,
  User,
  LogOut,
  Mail,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAIQueryStore } from "@/lib/store";
import { ThemeSelector } from "@/components/theme-selector";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SettingsTab =
  | "general"
  | "account"
  | "appearance"
  | "shortcuts"
  | "experimental";

function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Titlebar drag region */}
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0 bg-background"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-64 border-r border-border bg-muted/30 flex flex-col p-4 gap-2">
          <div className="flex items-center gap-2 px-2 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -ml-2"
              onClick={() => navigate({ to: "/" })}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-lg">Settings</div>
          </div>

          <Button
            variant={activeTab === "general" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("general")}
          >
            <Settings className="h-4 w-4" />
            General
          </Button>

          <Button
            variant={activeTab === "account" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("account")}
          >
            <User className="h-4 w-4" />
            Account
          </Button>

          <Button
            variant={activeTab === "appearance" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("appearance")}
          >
            <Palette className="h-4 w-4" />
            Appearance
          </Button>

          <Button
            variant={activeTab === "shortcuts" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("shortcuts")}
          >
            <Keyboard className="h-4 w-4" />
            Shortcuts
          </Button>

          <Button
            variant={activeTab === "experimental" ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setActiveTab("experimental")}
          >
            <FlaskConical className="h-4 w-4" />
            Experimental
          </Button>
        </aside>

        {/* Settings Content */}
        <main className="flex-1 overflow-auto p-8 max-w-3xl">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "account" && <AccountSettings />}
          {activeTab === "appearance" && <AppearanceSettings />}
          {activeTab === "shortcuts" && <ShortcutsSettings />}
          {activeTab === "experimental" && <ExperimentalSettings />}
        </main>
      </div>
    </div>
  );
}

function AccountSettings() {
  const { data: session, isPending, refetch } = authClient.useSession();

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
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {session.user.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                User ID: {session.user.id}
              </div>
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
            <form
              className="flex flex-col gap-4 max-w-xs mx-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get("email") as string;
                const password = formData.get("password") as string;

                const resp = await authClient.signIn.email({
                  email,
                  password,
                });

                console.log("Sign-in response:", resp);

                if (resp.error) return toast.error(resp.error.message);

                // Force session refresh using getSession
                const sessionResult = await authClient.getSession();
                console.log("Session result:", sessionResult);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
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
        <p className="text-muted-foreground">
          Manage general behavior and application settings.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Startup</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Auto-reconnect</Label>
            <p className="text-sm text-muted-foreground">
              Automatically connect to the last used database when the
              application starts
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
          <Switch
            checked={sidebarCollapsed}
            onCheckedChange={setSidebarCollapsed}
          />
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
        <p className="text-muted-foreground">
          Customize the look and feel of the application.
        </p>
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
              Show connection status, query times, and cursor position at the
              bottom
            </p>
          </div>
          <Switch
            checked={statusBarVisible}
            onCheckedChange={setStatusBarVisible}
          />
        </div>
      </div>
    </div>
  );
}

function ShortcutsSettings() {
  const shortcuts = [
    { name: "Toggle Sidebar", keys: ["⌘", "B"] },
    { name: "Toggle Querybuddy", keys: ["⌥", "⌘", "B"] },
    { name: "Run Query", keys: ["⌘", "Enter"] },
    { name: "Command Palette", keys: ["⌘", "K"] },
    { name: "New Connection", keys: ["⌘", "N"] },
    { name: "Refresh Data", keys: ["⌘", "R"] },
    { name: "Go to Data Tab", keys: ["⌘", "1"] },
    { name: "Go to Query Tab", keys: ["⌘", "2"] },
    { name: "Go to Querybuddy Tab", keys: ["⌘", "3"] },
    { name: "Toggle Terminal", keys: ["⌃", "`"] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Keyboard Shortcuts
        </h2>
        <p className="text-muted-foreground">
          View keyboard shortcuts for quick navigation and actions.
        </p>
      </div>
      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.name}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <span className="text-sm font-medium">{shortcut.name}</span>
            <div className="flex gap-1">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExperimentalSettings() {
  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);
  const setExperimentalTerminal = useAIQueryStore(
    (s) => s.setExperimentalTerminal,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Experimental</h2>
        <p className="text-muted-foreground">
          Try out experimental features. These features may be unstable or
          change in future updates.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Features</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">Integrated Terminal</Label>
            <p className="text-sm text-muted-foreground">
              Enable an integrated terminal panel for running shell commands
              directly within the application
            </p>
          </div>
          <Switch
            checked={experimentalTerminal}
            onCheckedChange={setExperimentalTerminal}
          />
        </div>
      </div>

      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Experimental features are provided as-is and may contain bugs or
          undergo significant changes. Use at your own discretion.
        </p>
      </div>
    </div>
  );
}
