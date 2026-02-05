import { invoke, isTauri } from "@tauri-apps/api/core";
import { defaultAppSettings, normalizeSettings, type AppSettings } from "./settings-schema";

interface RustAppSettings {
  schema_version: number;
  active_tab: string;
  ai_panel_open: boolean;
  ai_panel_width: number;
  sidebar_width: number;
  sidebar_collapsed: boolean;
  status_bar_visible: boolean;
  auto_reconnect: boolean;
  multi_connections_enabled: boolean;
  experimental_terminal: boolean;
  experimental_plugins: boolean;
  debug_mode: boolean;
  migrated_from_legacy: boolean;
}

const FALLBACK_STORAGE_KEY = "querystudio_settings_fallback";

function fromRustSettings(settings: RustAppSettings): AppSettings {
  return normalizeSettings({
    schemaVersion: settings.schema_version,
    activeTab: settings.active_tab,
    aiPanelOpen: settings.ai_panel_open,
    aiPanelWidth: settings.ai_panel_width,
    sidebarWidth: settings.sidebar_width,
    sidebarCollapsed: settings.sidebar_collapsed,
    statusBarVisible: settings.status_bar_visible,
    autoReconnect: settings.auto_reconnect,
    multiConnectionsEnabled: settings.multi_connections_enabled,
    experimentalTerminal: settings.experimental_terminal,
    experimentalPlugins: settings.experimental_plugins,
    debugMode: settings.debug_mode,
    migratedFromLegacy: settings.migrated_from_legacy,
  });
}

function toRustSettings(settings: AppSettings): RustAppSettings {
  const normalized = normalizeSettings(settings);
  return {
    schema_version: normalized.schemaVersion,
    active_tab: normalized.activeTab,
    ai_panel_open: normalized.aiPanelOpen,
    ai_panel_width: normalized.aiPanelWidth,
    sidebar_width: normalized.sidebarWidth,
    sidebar_collapsed: normalized.sidebarCollapsed,
    status_bar_visible: normalized.statusBarVisible,
    auto_reconnect: normalized.autoReconnect,
    multi_connections_enabled: normalized.multiConnectionsEnabled,
    experimental_terminal: normalized.experimentalTerminal,
    experimental_plugins: normalized.experimentalPlugins,
    debug_mode: normalized.debugMode,
    migrated_from_legacy: normalized.migratedFromLegacy,
  };
}

function patchToRust(patch: Partial<AppSettings>): Partial<RustAppSettings> {
  const rustPatch: Partial<RustAppSettings> = {};

  if (patch.schemaVersion !== undefined) rustPatch.schema_version = patch.schemaVersion;
  if (patch.activeTab !== undefined) rustPatch.active_tab = patch.activeTab;
  if (patch.aiPanelOpen !== undefined) rustPatch.ai_panel_open = patch.aiPanelOpen;
  if (patch.aiPanelWidth !== undefined) rustPatch.ai_panel_width = patch.aiPanelWidth;
  if (patch.sidebarWidth !== undefined) rustPatch.sidebar_width = patch.sidebarWidth;
  if (patch.sidebarCollapsed !== undefined) rustPatch.sidebar_collapsed = patch.sidebarCollapsed;
  if (patch.statusBarVisible !== undefined) rustPatch.status_bar_visible = patch.statusBarVisible;
  if (patch.autoReconnect !== undefined) rustPatch.auto_reconnect = patch.autoReconnect;
  if (patch.multiConnectionsEnabled !== undefined) {
    rustPatch.multi_connections_enabled = patch.multiConnectionsEnabled;
  }
  if (patch.experimentalTerminal !== undefined) {
    rustPatch.experimental_terminal = patch.experimentalTerminal;
  }
  if (patch.experimentalPlugins !== undefined) {
    rustPatch.experimental_plugins = patch.experimentalPlugins;
  }
  if (patch.debugMode !== undefined) rustPatch.debug_mode = patch.debugMode;
  if (patch.migratedFromLegacy !== undefined) {
    rustPatch.migrated_from_legacy = patch.migratedFromLegacy;
  }

  return rustPatch;
}

function getFallbackSettings(): AppSettings {
  const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
  if (!raw) return defaultAppSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return normalizeSettings(parsed);
  } catch {
    return defaultAppSettings;
  }
}

function setFallbackSettings(settings: AppSettings) {
  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(settings));
}

export const settingsApi = {
  async getSettings(): Promise<AppSettings> {
    if (!isTauri()) {
      return getFallbackSettings();
    }

    const settings = await invoke<RustAppSettings>("get_settings");
    return fromRustSettings(settings);
  },

  async setSettings(settings: AppSettings): Promise<AppSettings> {
    const normalized = normalizeSettings(settings);
    if (!isTauri()) {
      setFallbackSettings(normalized);
      return normalized;
    }

    const saved = await invoke<RustAppSettings>("set_settings", {
      settings: toRustSettings(normalized),
    });
    return fromRustSettings(saved);
  },

  async patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (!isTauri()) {
      const next = normalizeSettings({
        ...getFallbackSettings(),
        ...patch,
      });
      setFallbackSettings(next);
      return next;
    }

    const saved = await invoke<RustAppSettings>("patch_settings", {
      patch: patchToRust(patch),
    });
    return fromRustSettings(saved);
  },

  async resetSettings(): Promise<AppSettings> {
    if (!isTauri()) {
      setFallbackSettings(defaultAppSettings);
      return defaultAppSettings;
    }

    const settings = await invoke<RustAppSettings>("reset_settings");
    return fromRustSettings(settings);
  },
};
