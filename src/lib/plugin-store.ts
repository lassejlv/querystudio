// ============================================================================
// Plugin Store - Manages User-Installed Plugins
// ============================================================================
//
// This store handles the persistence and management of user-installed plugins.
// Plugins are stored in localStorage and loaded at app startup.
//
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LucideIcon } from "lucide-react";
import {
  Puzzle,
  FlaskConical,
  Sparkles,
  Zap,
  Star,
  Heart,
  Rocket,
  Globe,
  Code,
  Terminal,
  FileText,
  Database,
  Settings,
  Layout,
  Box,
} from "lucide-react";

// Available icons that plugins can use
export const PLUGIN_ICONS: Record<string, LucideIcon> = {
  puzzle: Puzzle,
  flask: FlaskConical,
  sparkles: Sparkles,
  zap: Zap,
  star: Star,
  heart: Heart,
  rocket: Rocket,
  globe: Globe,
  code: Code,
  terminal: Terminal,
  file: FileText,
  database: Database,
  settings: Settings,
  layout: Layout,
  box: Box,
};

export type PluginIconName = keyof typeof PLUGIN_ICONS;

// Plugin metadata stored in the store
export interface InstalledPlugin {
  // Unique identifier for this plugin
  id: string;
  // Plugin type (used as tab type)
  type: string;
  // Display name shown in UI
  displayName: string;
  // Icon name (references PLUGIN_ICONS)
  iconName: PluginIconName;
  // Plugin description
  description: string;
  // Plugin version
  version: string;
  // Plugin author
  author: string;
  // Whether the plugin is enabled
  enabled: boolean;
  // Installation date
  installedAt: string;
  // Source file path or URL (for reference)
  source?: string;
  // Plugin priority for tab menu ordering
  priority: number;
  // Whether plugin requires experimental mode
  experimental: boolean;
  // The actual component code (stored as string for localStorage plugins)
  // For bundled plugins, this will be empty
  componentCode?: string;
  // Whether this is a bundled plugin (comes with the app)
  isBundled: boolean;
}

// Plugin manifest format for importing
export interface PluginManifest {
  type: string;
  displayName: string;
  iconName?: PluginIconName;
  description?: string;
  version?: string;
  author?: string;
  priority?: number;
  experimental?: boolean;
}

interface PluginStoreState {
  // All installed plugins
  plugins: InstalledPlugin[];

  // Install a new plugin
  installPlugin: (plugin: Omit<InstalledPlugin, "id" | "installedAt">) => string;

  // Uninstall a plugin by ID
  uninstallPlugin: (id: string) => boolean;

  // Enable/disable a plugin
  togglePlugin: (id: string, enabled: boolean) => void;

  // Update a plugin
  updatePlugin: (id: string, updates: Partial<InstalledPlugin>) => void;

  // Get a plugin by ID
  getPlugin: (id: string) => InstalledPlugin | undefined;

  // Get a plugin by type
  getPluginByType: (type: string) => InstalledPlugin | undefined;

  // Get all enabled plugins
  getEnabledPlugins: () => InstalledPlugin[];

  // Check if a plugin type is already installed
  hasPluginType: (type: string) => boolean;

  // Clear all plugins (for debugging)
  clearAllPlugins: () => void;
}

// Generate a unique ID for plugins
function generatePluginId(): string {
  return `plugin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const usePluginStore = create<PluginStoreState>()(
  persist(
    (set, get) => ({
      plugins: [],

      installPlugin: (plugin) => {
        const id = generatePluginId();
        const installedPlugin: InstalledPlugin = {
          ...plugin,
          id,
          installedAt: new Date().toISOString(),
        };

        set((state) => ({
          plugins: [...state.plugins, installedPlugin],
        }));

        console.info(`[PluginStore] Installed plugin: ${plugin.displayName} (${id})`);
        return id;
      },

      uninstallPlugin: (id) => {
        const plugin = get().plugins.find((p) => p.id === id);
        if (!plugin) {
          console.warn(`[PluginStore] Plugin not found: ${id}`);
          return false;
        }

        if (plugin.isBundled) {
          console.warn(`[PluginStore] Cannot uninstall bundled plugin: ${id}`);
          return false;
        }

        set((state) => ({
          plugins: state.plugins.filter((p) => p.id !== id),
        }));

        console.info(`[PluginStore] Uninstalled plugin: ${plugin.displayName} (${id})`);
        return true;
      },

      togglePlugin: (id, enabled) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === id ? { ...p, enabled } : p
          ),
        }));
      },

      updatePlugin: (id, updates) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      getPlugin: (id) => {
        return get().plugins.find((p) => p.id === id);
      },

      getPluginByType: (type) => {
        return get().plugins.find((p) => p.type === type);
      },

      getEnabledPlugins: () => {
        return get().plugins.filter((p) => p.enabled);
      },

      hasPluginType: (type) => {
        return get().plugins.some((p) => p.type === type);
      },

      clearAllPlugins: () => {
        set({ plugins: [] });
        console.info("[PluginStore] Cleared all plugins");
      },
    }),
    {
      name: "querystudio-plugins",
      partialize: (state) => ({
        plugins: state.plugins,
      }),
    }
  )
);

// Helper to get the icon component for a plugin
export function getPluginIcon(iconName: PluginIconName): LucideIcon {
  return PLUGIN_ICONS[iconName] || Puzzle;
}

// Validate a plugin manifest
export function validatePluginManifest(
  manifest: unknown
): manifest is PluginManifest {
  if (!manifest || typeof manifest !== "object") {
    return false;
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.type !== "string" || !m.type.trim()) {
    return false;
  }

  if (typeof m.displayName !== "string" || !m.displayName.trim()) {
    return false;
  }

  return true;
}

// Parse a plugin file and extract manifest + component
export function parsePluginFile(
  fileContent: string
): { manifest: PluginManifest; componentCode: string } | null {
  try {
    // Look for a manifest comment block at the top of the file
    // Format: /* @plugin { "type": "...", "displayName": "..." } */
    const manifestMatch = fileContent.match(
      /\/\*\s*@plugin\s*(\{[\s\S]*?\})\s*\*\//
    );

    if (manifestMatch) {
      const manifestJson = manifestMatch[1];
      const manifest = JSON.parse(manifestJson);

      if (validatePluginManifest(manifest)) {
        return {
          manifest,
          componentCode: fileContent,
        };
      }
    }

    // Alternative: look for export const plugin = { ... }
    const exportMatch = fileContent.match(
      /export\s+const\s+plugin\s*[:=]\s*(\{[\s\S]*?\})\s*(?:;|as)/
    );

    if (exportMatch) {
      // This is a simplified parser - in production you'd want something more robust
      console.warn(
        "[PluginStore] Export-style manifest detection is experimental"
      );
    }

    return null;
  } catch (error) {
    console.error("[PluginStore] Failed to parse plugin file:", error);
    return null;
  }
}
