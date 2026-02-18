import * as React from "react";
import { AlignLeft, Copy, Trash2, Sparkles } from "lucide-react";
import { format as sqlFormat } from "sql-formatter";
import type { SqlLanguage } from "sql-formatter";
import type { TabContentProps } from "@/lib/tab-sdk";
import type { LocalPluginModule } from "@/lib/local-plugins";
import type { TabPluginRegistration } from "@/lib/tab-sdk";
import { usePluginSDK } from "@/lib/plugin-sdk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================================
// SQL Formatting Logic
// ============================================================================

const DB_TYPE_TO_LANGUAGE: Record<string, SqlLanguage> = {
  postgres: "postgresql",
  mysql: "mysql",
  sqlite: "sqlite",
  mssql: "transactsql",
  oracle: "plsql",
  mariadb: "mariadb",
};

function resolveSqlLanguage(databaseType: string | null): SqlLanguage {
  if (!databaseType) {
    return "sql";
  }

  return DB_TYPE_TO_LANGUAGE[databaseType.toLowerCase()] ?? "sql";
}

function formatSQL(
  sql: string,
  options: FormatOptions,
  databaseType: string | null,
): string {
  if (!sql.trim()) return "";

  return sqlFormat(sql, {
    language: resolveSqlLanguage(databaseType),
    tabWidth: options.indentSize,
    useTabs: false,
    keywordCase: options.uppercaseKeywords ? "upper" : "preserve",
  });
}

// ============================================================================
// Types
// ============================================================================

interface FormatOptions {
  uppercaseKeywords: boolean;
  indentSize: number;
}

// ============================================================================
// Plugin Definition
// ============================================================================

export const plugin: TabPluginRegistration = {
  type: "sql-formatter",
  displayName: "SQL Formatter",
  icon: AlignLeft,
  getDefaultTitle: () => "SQL Formatter",
  canCreate: true,
  allowMultiple: false,
  priority: 70,
  experimental: false,
  // This plugin is disabled by default and only shown for SQL databases
  supportedDatabases: [
    "postgres",
    "mysql",
    "sqlite",
    "mssql",
    "oracle",
    "mariadb",
  ],
};

// ============================================================================
// Component
// ============================================================================

export function Component({ tabId, paneId, connectionId }: TabContentProps) {
  const sdk = usePluginSDK(connectionId, tabId, paneId);
  const [input, setInput] = React.useState("");
  const [output, setOutput] = React.useState("");
  const [options, setOptions] = React.useState<FormatOptions>({
    uppercaseKeywords: true,
    indentSize: 2,
  });

  const handleFormat = React.useCallback(() => {
    if (!input.trim()) {
      sdk.utils.toast.info("Paste some SQL to format");
      return;
    }

    try {
      const formatted = formatSQL(input, options, sdk.connection.databaseType);
      setOutput(formatted);
      sdk.utils.toast.success("SQL formatted successfully");
    } catch {
      sdk.utils.toast.error("Failed to format SQL");
    }
  }, [input, options, sdk.connection.databaseType, sdk.utils.toast]);

  const handleCopy = React.useCallback(async () => {
    if (!output) {
      sdk.utils.toast.info("Nothing to copy");
      return;
    }

    const success = await sdk.utils.clipboard.copy(output);
    if (success) {
      sdk.utils.toast.success("Copied to clipboard");
    } else {
      sdk.utils.toast.error("Failed to copy");
    }
  }, [output, sdk.utils.clipboard, sdk.utils.toast]);

  const handleClear = React.useCallback(() => {
    setInput("");
    setOutput("");
    sdk.utils.toast.info("Cleared");
  }, [sdk.utils.toast]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to format
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleFormat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFormat]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button onClick={handleFormat} size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Format SQL
            <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-mono sm:inline">
              ⌘↵
            </kbd>
          </Button>
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!output}
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="uppercase"
              checked={options.uppercaseKeywords}
              onCheckedChange={(checked) =>
                setOptions((prev) => ({ ...prev, uppercaseKeywords: checked }))
              }
            />
            <Label htmlFor="uppercase" className="text-sm cursor-pointer">
              Uppercase
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="indent" className="text-sm">
              Indent
            </Label>
            <Select
              value={String(options.indentSize)}
              onValueChange={(value) =>
                setOptions((prev) => ({ ...prev, indentSize: Number(value) }))
              }
            >
              <SelectTrigger id="indent" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
                <SelectItem value="8">8 spaces</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Input Panel */}
        <div className="flex flex-1 flex-col gap-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Input SQL
          </Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your SQL here..."
            className={cn(
              "flex-1 resize-none font-mono text-sm",
              "bg-muted/50 focus:bg-background",
            )}
            spellCheck={false}
          />
        </div>

        {/* Output Panel */}
        <div className="flex flex-1 flex-col gap-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Formatted SQL
          </Label>
          <Textarea
            value={output}
            readOnly
            placeholder="Formatted SQL will appear here..."
            className={cn(
              "flex-1 resize-none font-mono text-sm",
              "bg-muted/30",
            )}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {input.length > 0 && (
            <>
              Input: {input.length} chars | Lines: {input.split("\n").length}
            </>
          )}
        </span>
        <span>
          {output.length > 0 && (
            <>
              Output: {output.length} chars | Lines: {output.split("\n").length}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

const sqlFormatterPlugin: LocalPluginModule = { plugin, Component };
export default sqlFormatterPlugin;
