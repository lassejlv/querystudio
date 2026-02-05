import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { Table2, Code, Terminal, FileQuestion } from "lucide-react";
import { useSyncExternalStore } from "react";

// ============================================================================
// Tab SDK - Extensible Tab System for QueryStudio
// ============================================================================
//
// This SDK provides a plugin-based architecture for adding new tab types.
// Built-in tab types: "data", "query", "terminal"
//
// Usage for plugin developers:
//
// 1. Create a TabPlugin implementation:
//    const myPlugin: TabPlugin = {
//      type: "my-custom-tab",
//      displayName: "My Custom Tab",
//      icon: MyIcon,
//      component: MyTabComponent,
//      // ... other properties
//    };
//
// 2. Register the plugin:
//    tabRegistry.register(myPlugin);
//
// 3. The tab type will now be available in the UI
// ============================================================================

// Base tab types that are built-in
export type BuiltInTabType = "data" | "query" | "terminal";

// Extended tab type that includes plugins
export type ExtendedTabType = BuiltInTabType | string;

// Props passed to tab content components
export interface TabContentProps {
  tabId: string;
  paneId: string;
  connectionId: string;
}

// Tab data interface - base structure for all tabs
export interface TabData {
  id: string;
  type: ExtendedTabType;
  title: string;
  // Common optional fields
  icon?: LucideIcon;
  // Type-specific data stored in metadata
  metadata?: Record<string, unknown>;
}

// Data tab specific metadata
export interface DataTabMetadata extends Record<string, unknown> {
  schema: string;
  name: string;
}

// Query tab specific metadata
export interface QueryTabMetadata extends Record<string, unknown> {
  queryContent?: string;
  queryResults?: {
    results: Array<{
      columns: string[];
      rows: unknown[][];
      row_count: number;
    }>;
    error: string | null;
    executionTime: number | null;
  };
}

// Terminal tab specific metadata
export interface TerminalTabMetadata extends Record<string, unknown> {
  terminalId: string;
  createdAt: Date;
}

// Options for creating a new tab
export interface CreateTabOptions {
  title?: string;
  makeActive?: boolean;
  metadata?: Record<string, unknown>;
  // Legacy support for data tabs
  tableInfo?: { schema: string; name: string };
  // Legacy support for query tabs
  queryContent?: string;
  // For terminal tabs
  terminalId?: string;
}

// Tab lifecycle hooks
export interface TabLifecycleHooks {
  // Called when tab is created
  onCreate?: (tabId: string, metadata: Record<string, unknown>) => Promise<void> | void;
  // Called when tab is about to be closed - return false to prevent close
  onBeforeClose?: (tabId: string, metadata: Record<string, unknown>) => Promise<boolean> | boolean;
  // Called after tab is closed
  onClose?: (tabId: string, metadata: Record<string, unknown>) => Promise<void> | void;
  // Called when tab becomes active
  onActivate?: (tabId: string, metadata: Record<string, unknown>) => void;
  // Called when tab becomes inactive
  onDeactivate?: (tabId: string, metadata: Record<string, unknown>) => void;
}

// Tab plugin definition
export interface TabPlugin {
  // Unique identifier for this tab type
  type: string;

  // Display name shown in UI
  displayName: string;

  // Icon component for the tab
  icon: LucideIcon;

  // Generate default title for new tabs
  getDefaultTitle: (index: number, metadata?: Record<string, unknown>) => string;

  // React component to render when tab is active
  // Set to null initially, will be set by registerTabComponent
  component: ComponentType<TabContentProps> | null;

  // Lifecycle hooks
  lifecycle?: TabLifecycleHooks;

  // Whether this tab type can be created by users (shown in + menu)
  canCreate: boolean;

  // Keyboard shortcut hint for creating this tab type
  createShortcut?: string;

  // Whether multiple instances of this tab type can exist
  allowMultiple: boolean;

  // Priority for sorting in creation menu (higher = first)
  priority: number;

  // Whether this plugin requires experimental features to be enabled
  experimental?: boolean;

  // List of supported database types (if undefined, all databases are supported)
  supportedDatabases?: string[];

  // Validate metadata before creating tab
  validateMetadata?: (metadata: Record<string, unknown>) => boolean;

  // Serialize metadata for persistence
  serializeMetadata?: (metadata: Record<string, unknown>) => Record<string, unknown>;

  // Deserialize metadata after loading from persistence
  deserializeMetadata?: (data: Record<string, unknown>) => Record<string, unknown>;
}

// Partial plugin for registration (some fields have defaults)
export type TabPluginRegistration = Omit<
  TabPlugin,
  "canCreate" | "allowMultiple" | "priority" | "component"
> & {
  canCreate?: boolean;
  allowMultiple?: boolean;
  priority?: number;
  component?: ComponentType<TabContentProps> | null;
};

// Registry for tab plugins
class TabPluginRegistry {
  private plugins: Map<string, TabPlugin> = new Map();
  private listeners: Set<() => void> = new Set();

  // Register a new tab plugin
  register(plugin: TabPluginRegistration): void {
    const fullPlugin: TabPlugin = {
      canCreate: true,
      allowMultiple: true,
      priority: 0,
      component: null,
      ...plugin,
    };

    this.plugins.set(plugin.type, fullPlugin);
    this.notifyListeners();
  }

  // Register or update the component for a tab type
  registerComponent(type: string, component: ComponentType<TabContentProps>): void {
    const plugin = this.plugins.get(type);
    if (plugin) {
      plugin.component = component;
      this.notifyListeners();
    } else {
      console.warn(`[TabSDK] Cannot register component for unknown tab type: ${type}`);
    }
  }

  // Unregister a tab plugin
  unregister(type: string): boolean {
    const result = this.plugins.delete(type);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  // Get a plugin by type
  get(type: string): TabPlugin | undefined {
    return this.plugins.get(type);
  }

  // Check if a plugin exists
  has(type: string): boolean {
    return this.plugins.has(type);
  }

  // Get all registered plugins
  getAll(): TabPlugin[] {
    return Array.from(this.plugins.values());
  }

  // Get all creatable plugins (sorted by priority)
  getCreatable(includeExperimental = false, databaseType?: string): TabPlugin[] {
    return this.getAll()
      .filter((p) => {
        if (!p.canCreate) return false;
        if (!includeExperimental && p.experimental) return false;
        // Filter by database type if specified and plugin has restrictions
        if (databaseType && p.supportedDatabases) {
          return p.supportedDatabases.includes(databaseType.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  // Get icon for a tab type
  getIcon(type: string): LucideIcon {
    return this.plugins.get(type)?.icon ?? FileQuestion;
  }

  // Get display name for a tab type
  getDisplayName(type: string): string {
    return this.plugins.get(type)?.displayName ?? type;
  }

  // Get component for a tab type
  getComponent(type: string): ComponentType<TabContentProps> | null {
    return this.plugins.get(type)?.component ?? null;
  }

  // Subscribe to registry changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// Global tab registry instance
export const tabRegistry = new TabPluginRegistry();

// ============================================================================
// Built-in Plugin Definitions
// ============================================================================

// Data tab plugin (table viewer)
export const dataTabPlugin: TabPluginRegistration = {
  type: "data",
  displayName: "Data",
  icon: Table2,
  getDefaultTitle: (index, metadata) => {
    if (metadata?.name) {
      return String(metadata.name);
    }
    return `Data ${index}`;
  },
  canCreate: true,
  allowMultiple: true,
  priority: 100,
  lifecycle: {
    onCreate: (tabId, metadata) => {
      console.debug(`[TabSDK] Data tab created: ${tabId}`, metadata);
    },
  },
};

// Query tab plugin (SQL editor)
export const queryTabPlugin: TabPluginRegistration = {
  type: "query",
  displayName: "Query",
  icon: Code,
  getDefaultTitle: (index) => `Query ${index}`,
  canCreate: true,
  allowMultiple: true,
  priority: 90,
  createShortcut: "⌘T",
  lifecycle: {
    onCreate: (tabId) => {
      console.debug(`[TabSDK] Query tab created: ${tabId}`);
    },
  },
};

// Terminal tab plugin
export const terminalTabPlugin: TabPluginRegistration = {
  type: "terminal",
  displayName: "Terminal",
  icon: Terminal,
  getDefaultTitle: (index) => `Terminal ${index}`,
  canCreate: true,
  allowMultiple: true,
  priority: 80,
  experimental: true, // Requires experimentalTerminal setting
  createShortcut: "⌘`",
  lifecycle: {
    onCreate: (tabId, metadata) => {
      console.debug(`[TabSDK] Terminal tab created: ${tabId}`, metadata);
    },
    onClose: (tabId, metadata) => {
      console.debug(`[TabSDK] Terminal tab closed: ${tabId}`, metadata);
      // Terminal cleanup is handled by the component
    },
  },
  serializeMetadata: (metadata) => {
    // Don't persist terminal state - they should be recreated
    return {
      terminalId: metadata.terminalId,
    };
  },
  deserializeMetadata: (data) => {
    return {
      terminalId: data.terminalId,
      createdAt: new Date(),
    };
  },
};

// Register built-in plugins (without components - those are registered separately)
export function registerBuiltInPlugins(): void {
  tabRegistry.register(dataTabPlugin);
  tabRegistry.register(queryTabPlugin);
  tabRegistry.register(terminalTabPlugin);
}

// ============================================================================
// Utility Functions
// ============================================================================

// Check if a tab type is a built-in type
export function isBuiltInTabType(type: string): type is BuiltInTabType {
  return type === "data" || type === "query" || type === "terminal";
}

// Get the icon for a tab based on its type
export function getTabIcon(type: string): LucideIcon {
  return tabRegistry.getIcon(type);
}

// Generate a default title for a tab
export function generateTabTitle(
  type: string,
  existingTabsOfType: number,
  metadata?: Record<string, unknown>,
): string {
  const plugin = tabRegistry.get(type);
  if (plugin) {
    return plugin.getDefaultTitle(existingTabsOfType + 1, metadata);
  }
  return `Tab ${existingTabsOfType + 1}`;
}

// ============================================================================
// React Hooks for Tab SDK
// ============================================================================

// Hook to get all plugins (re-renders on registry changes)
export function useTabPlugins(): TabPlugin[] {
  return useSyncExternalStore(
    (callback) => tabRegistry.subscribe(callback),
    () => tabRegistry.getAll(),
    () => tabRegistry.getAll(),
  );
}

// Hook to get creatable plugins
export function useCreatableTabPlugins(
  includeExperimental = false,
  databaseType?: string,
): TabPlugin[] {
  return useSyncExternalStore(
    (callback) => tabRegistry.subscribe(callback),
    () => tabRegistry.getCreatable(includeExperimental, databaseType),
    () => tabRegistry.getCreatable(includeExperimental, databaseType),
  );
}

// Hook to get a specific plugin
export function useTabPlugin(type: string): TabPlugin | undefined {
  return useSyncExternalStore(
    (callback) => tabRegistry.subscribe(callback),
    () => tabRegistry.get(type),
    () => tabRegistry.get(type),
  );
}

// Hook to get the component for a tab type
export function useTabComponent(type: string): ComponentType<TabContentProps> | null {
  return useSyncExternalStore(
    (callback) => tabRegistry.subscribe(callback),
    () => tabRegistry.getComponent(type),
    () => tabRegistry.getComponent(type),
  );
}
