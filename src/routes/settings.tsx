import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeSelector } from "@/components/theme-selector";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  discoverFontFamilies,
  getFallbackFontFamilies,
  normalizeCustomFontFamily,
} from "@/lib/app-font";
import { authClient, signInWithGithub } from "@/lib/auth-client";
import { CommandPalette } from "@/components/command-palette";
import { PluginSettings } from "@/components/plugin-settings";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { closeSettingsWindow } from "@/lib/settings-window";
import { useDisconnect } from "@/lib/hooks";
import type { SavedConnection } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SettingsTab = "general" | "account" | "appearance" | "experimental" | "plugins";

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
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
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
    { id: "experimental", label: "Experimental" },
    ...(experimentalPlugins ? [{ id: "plugins" as SettingsTab, label: "Plugins" }] : []),
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
              onClick={() => void closeSettingsWindow({ fallback: () => navigate({ to: "/" }) })}
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
            {activeTab === "plugins" && <PluginSettings />}
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

  useEffect(() => {
    if (session && isSigningIn) {
      setIsSigningIn(false);
    }
  }, [session, isSigningIn]);

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
      setIsSigningIn(false);
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
  const multiConnectionsEnabled = useAIQueryStore((s) => s.multiConnectionsEnabled);
  const setMultiConnectionsEnabled = useAIQueryStore((s) => s.setMultiConnectionsEnabled);
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAIQueryStore((s) => s.setSidebarCollapsed);
  const debugMode = useAIQueryStore((s) => s.debugMode);
  const setDebugMode = useAIQueryStore((s) => s.setDebugMode);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const disconnect = useDisconnect();

  const handleMultiConnectionsChange = async (enabled: boolean) => {
    setMultiConnectionsEnabled(enabled);
    if (enabled) return;

    const connectionsToClose = activeConnections.filter(
      (connection) => connection.id !== activeConnectionId,
    );

    for (const connection of connectionsToClose) {
      try {
        await disconnect.mutateAsync(connection.id);
      } catch {
        toast.error(`Failed to disconnect ${connection.name}`);
      }
    }
  };

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
            <Label className="text-base">Multiple Connections</Label>
            <p className="text-sm text-muted-foreground">
              Keep more than one database connection open with connection tabs
            </p>
          </div>
          <Switch
            checked={multiConnectionsEnabled}
            onCheckedChange={handleMultiConnectionsChange}
          />
        </div>

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
  const MAX_RENDERED_FONTS_DEFAULT = 80;
  const MAX_RENDERED_FONTS_SEARCH = 180;
  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);
  const setStatusBarVisible = useAIQueryStore((s) => s.setStatusBarVisible);
  const customFontFamily = useAIQueryStore((s) => s.customFontFamily);
  const setCustomFontFamily = useAIQueryStore((s) => s.setCustomFontFamily);
  const uiFontScale = useAIQueryStore((s) => s.uiFontScale);
  const setUiFontScale = useAIQueryStore((s) => s.setUiFontScale);
  const [fontDraft, setFontDraft] = useState(customFontFamily);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const [availableFonts, setAvailableFonts] = useState<string[]>(() => getFallbackFontFamilies());
  const [fontSource, setFontSource] = useState<"local" | "fallback">("fallback");
  const [isLoadingFonts, setIsLoadingFonts] = useState(false);
  const [hasLoadedFonts, setHasLoadedFonts] = useState(false);

  useEffect(() => {
    setFontDraft(customFontFamily);
  }, [customFontFamily]);

  const normalizedDraft = normalizeCustomFontFamily(fontDraft);
  const normalizedActiveFont = normalizeCustomFontFamily(customFontFamily);
  const hasPendingFontChanges = normalizedDraft !== normalizedActiveFont;
  const normalizedSearchQuery = fontSearchQuery.trim().toLowerCase();

  const filteredFonts = useMemo(() => {
    if (!normalizedSearchQuery) return availableFonts;
    return availableFonts.filter((font) => font.toLowerCase().includes(normalizedSearchQuery));
  }, [availableFonts, normalizedSearchQuery]);

  const renderLimit = normalizedSearchQuery
    ? MAX_RENDERED_FONTS_SEARCH
    : MAX_RENDERED_FONTS_DEFAULT;
  const visibleFonts = useMemo(
    () => filteredFonts.slice(0, renderLimit),
    [filteredFonts, renderLimit],
  );

  const detectFonts = async (forceRefresh = false) => {
    if (isLoadingFonts) return;
    setIsLoadingFonts(true);
    const result = await discoverFontFamilies({ forceRefresh });
    setAvailableFonts(result.families);
    setFontSource(result.source);
    setHasLoadedFonts(true);
    setIsLoadingFonts(false);
  };

  const applyFontChanges = () => {
    setCustomFontFamily(normalizedDraft);
  };

  const resetFontChanges = () => {
    setFontDraft("");
    setCustomFontFamily("");
  };

  const selectFont = (font: string) => {
    const normalized = normalizeCustomFontFamily(font);
    setFontDraft(normalized);
    setCustomFontFamily(normalized);
    setFontPickerOpen(false);
  };

  const handleFontPickerOpenChange = (open: boolean) => {
    setFontPickerOpen(open);
    if (!open) {
      setFontSearchQuery("");
    }
    if (open && !hasLoadedFonts) {
      void detectFonts();
    }
  };

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
        <h3 className="text-lg font-medium">Typography</h3>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label className="text-base">UI Font Size</Label>
            <p className="text-sm text-muted-foreground">
              Scale text across the application interface.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "small", label: "Small", preview: "92%" },
                  { value: "default", label: "Default", preview: "100%" },
                  { value: "large", label: "Large", preview: "108%" },
                ] as const
              ).map((option) => {
                const isActive = uiFontScale === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "h-9 min-w-24 justify-between gap-2",
                      !isActive && "text-muted-foreground",
                    )}
                    onClick={() => setUiFontScale(option.value)}
                  >
                    <span>{option.label}</span>
                    <span className="text-[10px] opacity-80">{option.preview}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label htmlFor="custom-font-family" className="text-base">
              Custom Font Family
            </Label>
            <p className="text-sm text-muted-foreground">
              Select from detected fonts or enter a CSS font-family list manually. Example:{" "}
              <span className="font-mono text-xs">"SF Pro Text", "Segoe UI", "Helvetica Neue"</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Popover open={fontPickerOpen} onOpenChange={handleFontPickerOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={fontPickerOpen}
                  className="h-9 flex-1 justify-between"
                >
                  <span className="truncate">{normalizedDraft || "Default (Geist)"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search fonts..."
                    className="h-9"
                    value={fontSearchQuery}
                    onValueChange={setFontSearchQuery}
                  />
                  <CommandList className="max-h-64">
                    <CommandEmpty>
                      {isLoadingFonts ? "Detecting fonts..." : "No fonts found for this search."}
                    </CommandEmpty>
                    <CommandGroup heading="Fonts">
                      <CommandItem
                        value="Default Geist"
                        onSelect={() => selectFont("")}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3 shrink-0",
                            normalizedDraft === "" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Default (Geist)
                      </CommandItem>
                      {visibleFonts.map((font) => (
                        <CommandItem
                          key={font}
                          value={font}
                          onSelect={() => selectFont(font)}
                          className="text-xs"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3 w-3 shrink-0",
                              normalizedDraft === normalizeCustomFontFamily(font)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="truncate">{font}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {filteredFonts.length > visibleFonts.length && (
                      <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                        Showing first {renderLimit} results. Keep typing to narrow down.
                      </div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void detectFonts(true)}
              disabled={isLoadingFonts}
              title="Refresh local fonts"
              aria-label="Refresh local fonts"
            >
              <RefreshCw className={cn("h-4 w-4", isLoadingFonts && "animate-spin")} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {!hasLoadedFonts && "Open the picker or refresh to detect local fonts on this device."}
            {hasLoadedFonts &&
              fontSource === "local" &&
              `Detected ${availableFonts.length} fonts from your system.`}
            {hasLoadedFonts &&
              fontSource === "fallback" &&
              "Local font access is unavailable; showing a common font list."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="custom-font-family"
              placeholder="e.g. SF Pro Text, Segoe UI, Helvetica Neue"
              value={fontDraft}
              onChange={(event) => setFontDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFontChanges();
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                onClick={applyFontChanges}
                disabled={!hasPendingFontChanges}
              >
                Apply
              </Button>
              <Button type="button" variant="outline" onClick={resetFontChanges}>
                Reset
              </Button>
            </div>
          </div>
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
  const experimentalOpencode = useAIQueryStore((s) => s.experimentalOpencode);
  const setExperimentalOpencode = useAIQueryStore((s) => s.setExperimentalOpencode);

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

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base">OpenCode Provider</Label>
            <p className="text-sm text-muted-foreground">
              Enable OpenCode as an AI provider. Connect to a local{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">opencode serve</code> instance.
              Tool support is limited — OpenCode uses its own built-in tools rather than
              QueryStudio's database tools.
            </p>
          </div>
          <Switch checked={experimentalOpencode} onCheckedChange={setExperimentalOpencode} />
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
