import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Settings,
  Palette,
  Keyboard,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAIQueryStore } from "@/lib/store";
import { ThemeSelector } from "@/components/theme-selector";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SettingsTab = "general" | "appearance" | "shortcuts";

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
        </aside>

        {/* Settings Content */}
        <main className="flex-1 overflow-auto p-8 max-w-3xl">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "appearance" && <AppearanceSettings />}
          {activeTab === "shortcuts" && <ShortcutsSettings />}
        </main>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const autoReconnect = useAIQueryStore((s) => s.autoReconnect);
  const setAutoReconnect = useAIQueryStore((s) => s.setAutoReconnect);
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAIQueryStore((s) => s.setSidebarCollapsed);

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
              Automatically connect to the last used database when the application starts
            </p>
          </div>
          <Switch
            checked={autoReconnect}
            onCheckedChange={setAutoReconnect}
          />
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
              Show connection status, query times, and cursor position at the bottom
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Keyboard Shortcuts</h2>
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
