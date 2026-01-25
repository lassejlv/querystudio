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

export const localPlugins: LocalPluginModule[] = [testTabPlugin];

export { testTabPlugin };
export const pluginCount = localPlugins.length;
