import { create } from "zustand";
import { settingsApi } from "./settings-api";
import { applyCustomFontFamily } from "./app-font";
import { applyUiFontScale } from "./app-ui-scale";
import { defaultAppSettings, normalizeSettings, type AppSettings } from "./settings-schema";

const LEGACY_UI_STATE_KEY = "querystudio_ui_state";
const LEGACY_AI_PANEL_WIDTH_KEY = "querystudio_ai_panel_width";

interface SettingsStoreState extends AppSettings {
  isHydrated: boolean;
  isSaving: boolean;
  lastError: string | null;
  initialize: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

interface LegacyUiStateEnvelope {
  state?: Partial<{
    activeTab: string;
    aiPanelOpen: boolean;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
    statusBarVisible: boolean;
    autoReconnect: boolean;
    experimentalTerminal: boolean;
    experimentalPlugins: boolean;
    debugMode: boolean;
  }>;
}

function pickSettings(state: SettingsStoreState): AppSettings {
  return {
    schemaVersion: state.schemaVersion,
    activeTab: state.activeTab,
    aiPanelOpen: state.aiPanelOpen,
    aiPanelWidth: state.aiPanelWidth,
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    statusBarVisible: state.statusBarVisible,
    autoReconnect: state.autoReconnect,
    multiConnectionsEnabled: state.multiConnectionsEnabled,
    experimentalTerminal: state.experimentalTerminal,
    experimentalPlugins: state.experimentalPlugins,
    experimentalOpencode: state.experimentalOpencode,
    debugMode: state.debugMode,
    customFontFamily: state.customFontFamily,
    uiFontScale: state.uiFontScale,
    migratedFromLegacy: state.migratedFromLegacy,
  };
}

function getLegacySettingsPatch(): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};

  const legacyStateRaw = localStorage.getItem(LEGACY_UI_STATE_KEY);
  if (legacyStateRaw) {
    try {
      const parsed = JSON.parse(legacyStateRaw) as LegacyUiStateEnvelope;
      const legacy = parsed.state;
      if (legacy?.activeTab !== undefined) patch.activeTab = legacy.activeTab;
      if (legacy?.aiPanelOpen !== undefined) patch.aiPanelOpen = legacy.aiPanelOpen;
      if (legacy?.sidebarWidth !== undefined) patch.sidebarWidth = legacy.sidebarWidth;
      if (legacy?.sidebarCollapsed !== undefined) patch.sidebarCollapsed = legacy.sidebarCollapsed;
      if (legacy?.statusBarVisible !== undefined) patch.statusBarVisible = legacy.statusBarVisible;
      if (legacy?.autoReconnect !== undefined) patch.autoReconnect = legacy.autoReconnect;
      if (legacy?.experimentalTerminal !== undefined) {
        patch.experimentalTerminal = legacy.experimentalTerminal;
      }
      if (legacy?.experimentalPlugins !== undefined) {
        patch.experimentalPlugins = legacy.experimentalPlugins;
      }
      if (legacy?.debugMode !== undefined) patch.debugMode = legacy.debugMode;
    } catch {
      // Ignore malformed legacy JSON and proceed with defaults/current settings.
    }
  }

  const legacyAiPanelWidthRaw = localStorage.getItem(LEGACY_AI_PANEL_WIDTH_KEY);
  if (legacyAiPanelWidthRaw) {
    const parsedWidth = Number.parseInt(legacyAiPanelWidthRaw, 10);
    if (Number.isFinite(parsedWidth)) {
      patch.aiPanelWidth = parsedWidth;
    }
  }

  return patch;
}

function clearLegacyKeys() {
  localStorage.removeItem(LEGACY_UI_STATE_KEY);
  localStorage.removeItem(LEGACY_AI_PANEL_WIDTH_KEY);
}

export const useSettingsStore = create<SettingsStoreState>()((set, get) => ({
  ...defaultAppSettings,
  isHydrated: false,
  isSaving: false,
  lastError: null,

  initialize: async () => {
    if (get().isHydrated) return;

    try {
      const loadedSettings = await settingsApi.getSettings();
      let effectiveSettings = loadedSettings;

      if (!loadedSettings.migratedFromLegacy) {
        const legacyPatch = getLegacySettingsPatch();
        if (Object.keys(legacyPatch).length > 0) {
          effectiveSettings = await settingsApi.setSettings(
            normalizeSettings({
              ...loadedSettings,
              ...legacyPatch,
              migratedFromLegacy: true,
            }),
          );
          clearLegacyKeys();
        } else {
          effectiveSettings = await settingsApi.patchSettings({ migratedFromLegacy: true });
        }
      }

      set({
        ...effectiveSettings,
        isHydrated: true,
        isSaving: false,
        lastError: null,
      });
    } catch (error) {
      set({
        ...defaultAppSettings,
        isHydrated: true,
        isSaving: false,
        lastError: error instanceof Error ? error.message : "Failed to load settings",
      });
    }
  },

  updateSettings: async (patch) => {
    const optimistic = normalizeSettings({
      ...pickSettings(get()),
      ...patch,
    });

    set({
      ...optimistic,
      isSaving: true,
      lastError: null,
    });

    try {
      const saved = await settingsApi.patchSettings(patch);
      set({
        ...saved,
        isSaving: false,
        lastError: null,
      });
    } catch (error) {
      set({
        isSaving: false,
        lastError: error instanceof Error ? error.message : "Failed to save settings",
      });
    }
  },

  resetSettings: async () => {
    set({ isSaving: true, lastError: null });
    try {
      const reset = await settingsApi.resetSettings();
      set({
        ...reset,
        isSaving: false,
        lastError: null,
      });
    } catch (error) {
      set({
        isSaving: false,
        lastError: error instanceof Error ? error.message : "Failed to reset settings",
      });
    }
  },
}));

let initializationPromise: Promise<void> | null = null;

export function initializeSettingsStore(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = useSettingsStore.getState().initialize();
  }

  return initializationPromise;
}

if (typeof document !== "undefined") {
  let previousCustomFontFamily = useSettingsStore.getState().customFontFamily;
  let previousUiFontScale = useSettingsStore.getState().uiFontScale;
  applyCustomFontFamily(previousCustomFontFamily);
  applyUiFontScale(previousUiFontScale);

  useSettingsStore.subscribe((state) => {
    if (state.customFontFamily !== previousCustomFontFamily) {
      previousCustomFontFamily = state.customFontFamily;
      applyCustomFontFamily(state.customFontFamily);
    }
    if (state.uiFontScale !== previousUiFontScale) {
      previousUiFontScale = state.uiFontScale;
      applyUiFontScale(state.uiFontScale);
    }
  });
}
