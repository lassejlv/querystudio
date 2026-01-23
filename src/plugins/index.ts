// ============================================================================
// Local Plugins Index
// ============================================================================
//
// This file aggregates all local plugins for easy registration.
// To add a new plugin:
// 1. Create your plugin file in this directory (e.g., my-plugin.tsx)
// 2. Import it below
// 3. Add it to the localPlugins array
//
// ============================================================================

import type { LocalPluginModule } from "@/lib/local-plugins";

// Import local plugins
import testTabPlugin from "./test-tab";

// ============================================================================
// All Local Plugins
// ============================================================================
//
// Add your plugins to this array to register them with the Tab SDK.
// Plugins are registered in the order they appear here.
//
// ============================================================================

export const localPlugins: LocalPluginModule[] = [
  // Test tab - demonstration plugin
  testTabPlugin,

  // Add your plugins here:
  // myCustomPlugin,
  // anotherPlugin,
];

// Re-export for convenience
export { testTabPlugin };

// Export count for debugging
export const pluginCount = localPlugins.length;
