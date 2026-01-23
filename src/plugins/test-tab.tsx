// ============================================================================
// Test Tab Plugin
// ============================================================================
//
// This is a sample local plugin that demonstrates how to create a custom
// tab type using the Tab SDK. It serves as a template for developing
// your own tab plugins.
//
// To create your own plugin:
// 1. Copy this file as a starting point
// 2. Change the plugin type, displayName, and icon
// 3. Implement your own Component with the desired functionality
// 4. Import and register in src/plugins/index.ts
//
// ============================================================================

import { useState, useCallback } from "react";
import { FlaskConical, Plus, Minus, RotateCcw, Sparkles } from "lucide-react";
import type { TabPluginRegistration, TabContentProps } from "@/lib/tab-sdk";
import type { LocalPluginModule } from "@/lib/local-plugins";

// ============================================================================
// Plugin Definition
// ============================================================================

export const plugin: TabPluginRegistration = {
  type: "test-tab",
  displayName: "Test Tab",
  icon: FlaskConical,
  getDefaultTitle: (index) => `Test Tab ${index}`,
  canCreate: true,
  allowMultiple: true,
  priority: 50, // Lower than built-in tabs
  experimental: false, // Set to true if you want it hidden behind experimental flag
  lifecycle: {
    onCreate: (tabId, metadata) => {
      console.log(`[TestTab] Created: ${tabId}`, metadata);
    },
    onClose: (tabId) => {
      console.log(`[TestTab] Closed: ${tabId}`);
    },
    onActivate: (tabId) => {
      console.log(`[TestTab] Activated: ${tabId}`);
    },
    onDeactivate: (tabId) => {
      console.log(`[TestTab] Deactivated: ${tabId}`);
    },
  },
};

// ============================================================================
// Tab Component
// ============================================================================

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  const [count, setCount] = useState(0);
  const [clicks, setClicks] = useState<{ time: Date; action: string }[]>([]);

  const logAction = useCallback((action: string) => {
    setClicks((prev) => [{ time: new Date(), action }, ...prev].slice(0, 10));
  }, []);

  const increment = useCallback(() => {
    setCount((c) => c + 1);
    logAction("Increment");
  }, [logAction]);

  const decrement = useCallback(() => {
    setCount((c) => c - 1);
    logAction("Decrement");
  }, [logAction]);

  const reset = useCallback(() => {
    setCount(0);
    logAction("Reset");
  }, [logAction]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Test Tab Plugin
            </h1>
            <p className="text-sm text-muted-foreground">
              A demonstration of the Tab SDK plugin system
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Tab Info Card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Tab Information
            </h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tab ID:</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {tabId}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pane ID:</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {paneId}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connection ID:</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {connectionId}
                </code>
              </div>
            </div>
          </div>

          {/* Counter Demo */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium text-foreground">
              Interactive Counter Demo
            </h2>
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl font-bold tabular-nums text-foreground">
                {count}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={decrement}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={reset}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={increment}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Log */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium text-foreground">
              Action Log
            </h2>
            {clicks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No actions yet. Try clicking the buttons above!
              </p>
            ) : (
              <div className="space-y-1">
                {clicks.map((click, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm"
                  >
                    <span className="text-foreground">{click.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {click.time.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How to Create Plugins */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <h2 className="mb-2 text-sm font-medium text-foreground">
              Creating Your Own Plugin
            </h2>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>
                Copy this file to <code>src/plugins/your-plugin.tsx</code>
              </li>
              <li>Modify the plugin definition with your type and settings</li>
              <li>Implement your Component with desired functionality</li>
              <li>
                Import and add to the plugins array in{" "}
                <code>src/plugins/index.ts</code>
              </li>
              <li>Restart the application to see your new tab type!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Export as LocalPluginModule
// ============================================================================

const testTabPlugin: LocalPluginModule = {
  plugin,
  Component,
};

export default testTabPlugin;
