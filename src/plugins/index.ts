// ============================================================================
// Local Plugins Index
// ============================================================================
import type { LocalPluginModule } from "@/lib/local-plugins";
import sqlFormatterPlugin from "./sql-formatter";
import dataGeneratorPlugin from "./data-generator";

// ============================================================================
// All Local Plugins
// ============================================================================

export const localPlugins: LocalPluginModule[] = [sqlFormatterPlugin, dataGeneratorPlugin];

export {};
export const pluginCount = localPlugins.length;
