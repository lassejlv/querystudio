import { normalizeCustomFontFamily } from "./app-font";

export const SETTINGS_SCHEMA_VERSION = 1;

export type UIFontScale = "small" | "default" | "large";

export interface AppSettings {
  schemaVersion: number;
  activeTab: string;
  aiPanelOpen: boolean;
  aiPanelWidth: number;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  statusBarVisible: boolean;
  autoReconnect: boolean;
  multiConnectionsEnabled: boolean;
  experimentalTerminal: boolean;
  experimentalPlugins: boolean;
  experimentalOpencode: boolean;
  debugMode: boolean;
  customFontFamily: string;
  uiFontScale: UIFontScale;
  migratedFromLegacy: boolean;
}

export const defaultAppSettings: AppSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  activeTab: "data",
  aiPanelOpen: false,
  aiPanelWidth: 420,
  sidebarWidth: 256,
  sidebarCollapsed: false,
  statusBarVisible: true,
  autoReconnect: true,
  multiConnectionsEnabled: true,
  experimentalTerminal: false,
  experimentalPlugins: false,
  experimentalOpencode: false,
  debugMode: false,
  customFontFamily: "",
  uiFontScale: "default",
  migratedFromLegacy: false,
};

export function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = {
    ...defaultAppSettings,
    ...input,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  };

  return {
    ...merged,
    activeTab: merged.activeTab?.trim() ? merged.activeTab : defaultAppSettings.activeTab,
    aiPanelWidth: Math.min(800, Math.max(320, merged.aiPanelWidth)),
    sidebarWidth: Math.min(400, Math.max(180, merged.sidebarWidth)),
    customFontFamily: normalizeCustomFontFamily(merged.customFontFamily || ""),
    uiFontScale:
      merged.uiFontScale === "small" || merged.uiFontScale === "large"
        ? merged.uiFontScale
        : "default",
  };
}
