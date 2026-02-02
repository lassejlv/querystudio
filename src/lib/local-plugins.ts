// ============================================================================
// Local Plugin Loader for Tab SDK
// ============================================================================
//
// This module provides functionality to load local tab plugins.
// It works with both bundled plugins (shipped with the app) and
// user-installed plugins (managed through the plugin store).
//
// Bundled plugins are defined in src/plugins/ and registered at startup.
// User plugins can be imported through Settings > Plugins.
//
// ============================================================================

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { TabPluginRegistration, TabContentProps } from "./tab-sdk";
import { tabRegistry } from "./tab-sdk";
import {
  usePluginStore,
  getPluginIcon,
  PLUGIN_ICONS,
  type InstalledPlugin,
  type PluginIconName,
} from "./plugin-store";
import { createImportedPluginComponent } from "@/components/imported-plugin-placeholder";

// Interface for a bundled plugin module
export interface LocalPluginModule {
  // The plugin definition
  plugin: TabPluginRegistration;
  // The React component for the tab
  Component: ComponentType<TabContentProps>;
}

// Track registered local plugins for debugging/management
const registeredLocalPlugins: Map<string, LocalPluginModule> = new Map();

/**
 * Register a bundled plugin with the Tab SDK
 *
 * @param module - The plugin module containing plugin definition and Component
 * @returns true if registered successfully, false otherwise
 */
export function registerLocalPlugin(module: LocalPluginModule): boolean {
  const { plugin, Component } = module;

  if (!plugin || !plugin.type) {
    console.error("[LocalPlugins] Invalid plugin: missing type");
    return false;
  }

  if (!Component) {
    console.error(`[LocalPlugins] Invalid plugin "${plugin.type}": missing Component`);
    return false;
  }

  // Check if already registered
  if (tabRegistry.has(plugin.type)) {
    console.warn(`[LocalPlugins] Plugin "${plugin.type}" is already registered, skipping`);
    return false;
  }

  try {
    // Register the plugin definition
    tabRegistry.register(plugin);

    // Register the component
    tabRegistry.registerComponent(plugin.type, Component);

    // Track locally
    registeredLocalPlugins.set(plugin.type, module);

    console.info(`[LocalPlugins] Registered plugin: ${plugin.type} (${plugin.displayName})`);
    return true;
  } catch (error) {
    console.error(`[LocalPlugins] Failed to register plugin "${plugin.type}":`, error);
    return false;
  }
}

/**
 * Unregister a local plugin
 *
 * @param type - The plugin type to unregister
 * @returns true if unregistered successfully, false otherwise
 */
export function unregisterLocalPlugin(type: string): boolean {
  if (!registeredLocalPlugins.has(type)) {
    console.warn(`[LocalPlugins] Plugin "${type}" is not a local plugin`);
    return false;
  }

  const result = tabRegistry.unregister(type);
  if (result) {
    registeredLocalPlugins.delete(type);
    console.info(`[LocalPlugins] Unregistered plugin: ${type}`);
  }
  return result;
}

/**
 * Get all registered local plugins
 */
export function getLocalPlugins(): Map<string, LocalPluginModule> {
  return new Map(registeredLocalPlugins);
}

/**
 * Check if a plugin type is a local plugin
 */
export function isLocalPlugin(type: string): boolean {
  return registeredLocalPlugins.has(type);
}

/**
 * Register multiple bundled plugins at once
 *
 * @param modules - Array of plugin modules to register
 * @returns Object with counts of successful and failed registrations
 */
export function registerLocalPlugins(modules: LocalPluginModule[]): {
  success: number;
  failed: number;
} {
  let success = 0;
  let failed = 0;

  for (const module of modules) {
    if (registerLocalPlugin(module)) {
      success++;
    } else {
      failed++;
    }
  }

  console.info(`[LocalPlugins] Registered ${success} bundled plugin(s), ${failed} failed`);

  return { success, failed };
}

/**
 * Create a plugin module helper - makes it easier to create properly typed plugins
 *
 * @param plugin - The plugin registration object
 * @param Component - The React component
 * @returns A properly typed LocalPluginModule
 */
export function createPlugin(
  plugin: TabPluginRegistration,
  Component: ComponentType<TabContentProps>,
): LocalPluginModule {
  return { plugin, Component };
}

/**
 * Register an installed plugin from the plugin store with the Tab SDK
 * This is for user-installed plugins that have a component already loaded
 *
 * @param installedPlugin - The installed plugin metadata
 * @param Component - The React component for the plugin
 * @returns true if registered successfully
 */
export function registerInstalledPlugin(
  installedPlugin: InstalledPlugin,
  Component: ComponentType<TabContentProps>,
): boolean {
  if (!installedPlugin.enabled) {
    console.info(`[LocalPlugins] Skipping disabled plugin: ${installedPlugin.displayName}`);
    return false;
  }

  if (tabRegistry.has(installedPlugin.type)) {
    console.warn(`[LocalPlugins] Plugin type "${installedPlugin.type}" already registered`);
    return false;
  }

  const pluginRegistration: TabPluginRegistration = {
    type: installedPlugin.type,
    displayName: installedPlugin.displayName,
    icon: getPluginIcon(installedPlugin.iconName),
    getDefaultTitle: (index) => `${installedPlugin.displayName} ${index}`,
    canCreate: true,
    allowMultiple: true,
    priority: installedPlugin.priority,
    experimental: installedPlugin.experimental,
  };

  try {
    tabRegistry.register(pluginRegistration);
    tabRegistry.registerComponent(installedPlugin.type, Component);

    console.info(`[LocalPlugins] Registered installed plugin: ${installedPlugin.displayName}`);
    return true;
  } catch (error) {
    console.error(`[LocalPlugins] Failed to register installed plugin:`, error);
    return false;
  }
}

/**
 * Sync plugins from the plugin store with the Tab SDK
 * This should be called at app startup after bundled plugins are registered
 *
 * @param componentMap - Map of plugin types to their React components
 */
export function syncInstalledPlugins(
  componentMap: Map<string, ComponentType<TabContentProps>>,
): void {
  const plugins = usePluginStore.getState().plugins;

  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    if (plugin.isBundled) continue; // Bundled plugins are registered separately

    const Component = componentMap.get(plugin.type);
    if (Component) {
      registerInstalledPlugin(plugin, Component);
    } else {
      console.warn(`[LocalPlugins] No component found for installed plugin: ${plugin.type}`);
    }
  }
}

/**
 * Try to derive the icon name from a LucideIcon component
 * by matching against known icons in PLUGIN_ICONS
 */
function deriveIconName(icon: LucideIcon): PluginIconName {
  for (const [name, IconComponent] of Object.entries(PLUGIN_ICONS)) {
    if (IconComponent === icon) {
      return name as PluginIconName;
    }
  }
  return "puzzle"; // Default fallback
}

/**
 * Register all user-imported plugins from the plugin store with the Tab SDK
 * These plugins will use a placeholder component until properly bundled
 */
export function registerImportedPlugins(): {
  success: number;
  skipped: number;
} {
  const plugins = usePluginStore.getState().plugins;
  let success = 0;
  let skipped = 0;

  for (const plugin of plugins) {
    // Skip bundled plugins (they're registered separately)
    if (plugin.isBundled) {
      continue;
    }

    // Skip disabled plugins
    if (!plugin.enabled) {
      skipped++;
      continue;
    }

    // Skip if already registered
    if (tabRegistry.has(plugin.type)) {
      continue;
    }

    // Create a placeholder component for this imported plugin
    const PlaceholderComponent = createImportedPluginComponent(plugin.type);

    // Register with the Tab SDK
    const registered = registerInstalledPlugin(plugin, PlaceholderComponent);
    if (registered) {
      success++;
    }
  }

  if (success > 0) {
    console.info(`[LocalPlugins] Registered ${success} imported plugin(s), ${skipped} disabled`);
  }

  return { success, skipped };
}

/**
 * Install a bundled plugin to the plugin store (for tracking purposes)
 * This marks the plugin as bundled so it can't be uninstalled
 */
export function trackBundledPlugin(module: LocalPluginModule): void {
  const store = usePluginStore.getState();
  const { plugin } = module;

  // Check if already tracked
  if (store.hasPluginType(plugin.type)) {
    return;
  }

  // Try to derive the icon name from the plugin's icon
  const iconName = deriveIconName(plugin.icon);

  // Check if this plugin should be disabled by default
  // Plugins with supportedDatabases are disabled by default and enabled when connecting to a supported database
  const enabledByDefault = !plugin.supportedDatabases;

  store.installPlugin({
    type: plugin.type,
    displayName: plugin.displayName,
    iconName,
    description: `Built-in ${plugin.displayName} tab`,
    version: "1.0.0",
    author: "QueryStudio",
    enabled: enabledByDefault,
    priority: plugin.priority ?? 50,
    experimental: plugin.experimental ?? false,
    isBundled: true,
  });
}
