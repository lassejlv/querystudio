// ============================================================================
// Imported Plugin Placeholder Component
// ============================================================================
//
// This component is rendered for user-imported plugins that haven't been
// bundled with the application. It displays information about the plugin
// and instructions for how to properly integrate it.
//
// ============================================================================

import { FileCode, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { TabContentProps } from "@/lib/tab-sdk";
import { usePluginStore, getPluginIcon } from "@/lib/plugin-store";
import { Button } from "@/components/ui/button";

interface ImportedPluginPlaceholderProps extends TabContentProps {
  pluginType: string;
}

export function ImportedPluginPlaceholder({
  tabId,
  paneId,
  connectionId,
  pluginType,
}: ImportedPluginPlaceholderProps) {
  const [copied, setCopied] = useState(false);
  const plugin = usePluginStore((s) =>
    s.plugins.find((p) => p.type === pluginType),
  );

  if (!plugin) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>Plugin not found: {pluginType}</p>
        </div>
      </div>
    );
  }

  const Icon = getPluginIcon(plugin.iconName);

  const handleCopyCode = async () => {
    if (plugin.componentCode) {
      await navigator.clipboard.writeText(plugin.componentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {plugin.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {plugin.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Info Card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <FileCode className="h-4 w-4 text-primary" />
              Plugin Information
            </h2>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {plugin.type}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span>{plugin.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author:</span>
                <span>{plugin.author}</span>
              </div>
              {plugin.source && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source:</span>
                  <span className="text-xs">{plugin.source}</span>
                </div>
              )}
            </div>
          </div>

          {/* Placeholder Message */}
          <div className="rounded-lg border border-dashed border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
            <h3 className="text-lg font-medium text-yellow-600 dark:text-yellow-400 mb-2">
              Imported Plugin
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This plugin was imported from a file but hasn't been bundled with
              the application yet. To use this plugin's full functionality, you
              need to add it to the source code.
            </p>
          </div>

          {/* Instructions */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium text-foreground">
              How to Bundle This Plugin
            </h2>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                Copy the plugin code to{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  src/plugins/{plugin.type}.tsx
                </code>
              </li>
              <li>
                Add it to{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  src/plugins/index.ts
                </code>
              </li>
              <li>Rebuild the application</li>
            </ol>
          </div>

          {/* Code Preview */}
          {plugin.componentCode && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-foreground">
                  Plugin Code
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs font-mono">
                {plugin.componentCode.slice(0, 2000)}
                {plugin.componentCode.length > 2000 && "\n\n... (truncated)"}
              </pre>
            </div>
          )}

          {/* Tab Context */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
            <h3 className="font-medium mb-2">Tab Context</h3>
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              <div>Tab ID: {tabId}</div>
              <div>Pane ID: {paneId}</div>
              <div>Connection ID: {connectionId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Factory function to create a placeholder component for a specific plugin type
export function createImportedPluginComponent(
  pluginType: string,
): React.ComponentType<TabContentProps> {
  return function ImportedPluginWrapper(props: TabContentProps) {
    return <ImportedPluginPlaceholder {...props} pluginType={pluginType} />;
  };
}
