import { memo, useMemo, useCallback } from "react";
import { Table2, Code, Terminal } from "lucide-react";
import { useLayoutStore, type TabType } from "@/lib/layout-store";
import { useConnectionStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PaneWelcomeScreenProps {
  connectionId: string;
  paneId: string;
  dbType?: string;
}

// Static plugin definitions to avoid re-renders
const STATIC_PLUGINS = [
  {
    type: "data" as TabType,
    displayName: "Data",
    icon: Table2,
  },
  {
    type: "query" as TabType,
    displayName: "Query",
    icon: Code,
  },
  {
    type: "terminal" as TabType,
    displayName: "Terminal",
    icon: Terminal,
  },
];

export const PaneWelcomeScreen = memo(function PaneWelcomeScreen({
  connectionId,
  paneId,
  dbType,
}: PaneWelcomeScreenProps) {
  const createTab = useLayoutStore((s) => s.createTab);
  const tables = useConnectionStore((s) => s.tables);

  const isRedis = dbType === "redis";
  const isMongoDB = dbType === "mongodb";

  // Filter plugins based on database type - use static list
  const availablePlugins = useMemo(() => {
    return STATIC_PLUGINS.filter((plugin) => {
      // Query tab not available for MongoDB
      if (plugin.type === "query" && isMongoDB) return false;
      return true;
    });
  }, [isMongoDB]);

  const handleCreateTab = useCallback(
    (type: TabType) => {
      createTab(connectionId, paneId, type, {});
    },
    [createTab, connectionId, paneId],
  );

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium text-foreground mb-2">Welcome</h1>
          <p className="text-muted-foreground text-sm">
            {isRedis
              ? "Connected to Redis. Open a console to run commands."
              : isMongoDB
                ? "Connected to MongoDB. Browse collections or add a new document."
                : "Select a table from the sidebar or create a new tab to get started."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
          {availablePlugins.slice(0, 3).map((plugin) => {
            const Icon = plugin.icon;
            return (
              <button
                key={plugin.type}
                onClick={() => handleCreateTab(plugin.type)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg",
                  "bg-secondary/30 hover:bg-secondary/60",
                  "transition-colors duration-150",
                  "cursor-pointer",
                )}
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-foreground">{plugin.displayName}</span>
              </button>
            );
          })}
        </div>

        {/* Tables Quick Access */}
        {tables.length > 0 && !isRedis && (
          <div className="mb-8">
            <h2 className="text-sm text-muted-foreground mb-3">Recent Tables</h2>
            <div className="flex flex-wrap gap-2">
              {tables.slice(0, 6).map((table) => (
                <button
                  key={`${table.schema}.${table.name}`}
                  onClick={() =>
                    createTab(connectionId, paneId, "data", {
                      tableInfo: { schema: table.schema, name: table.name },
                      title: table.name,
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm",
                    "bg-secondary/30 hover:bg-secondary/60",
                    "text-foreground transition-colors",
                  )}
                >
                  {table.name}
                </button>
              ))}
              {tables.length > 6 && (
                <span className="px-3 py-1.5 text-sm text-muted-foreground">
                  +{tables.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
