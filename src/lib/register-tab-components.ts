// ============================================================================
// Tab Components Registration
// ============================================================================
//
// This file registers the React components for each built-in tab type.
// Components are registered separately from plugin definitions to avoid
// circular dependencies and enable code splitting.
//
// This file should be imported once at app initialization, after the
// built-in plugins have been registered.
// ============================================================================

import { tabRegistry } from "./tab-sdk";
import { TableViewer } from "@/components/table-viewer";
import { QueryEditor } from "@/components/query-editor";
import { TerminalTabContent } from "@/components/terminal-tab-content";

// Register all built-in tab components
export function registerTabComponents(): void {
  // Data tab - renders TableViewer
  tabRegistry.registerComponent("data", TableViewer);

  // Query tab - renders QueryEditor
  tabRegistry.registerComponent("query", QueryEditor);

  // Terminal tab - renders TerminalTabContent
  tabRegistry.registerComponent("terminal", TerminalTabContent);
}
