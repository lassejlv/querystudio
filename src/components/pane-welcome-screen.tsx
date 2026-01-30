import { memo, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Table2, Keyboard, MousePointerClick, Code, Terminal } from "lucide-react";
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
    createShortcut: undefined,
  },
  {
    type: "query" as TabType,
    displayName: "Query",
    icon: Code,
    createShortcut: "⌘T",
  },
  {
    type: "terminal" as TabType,
    displayName: "Terminal",
    icon: Terminal,
    createShortcut: "⌘`",
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

  const shortcuts = [
    { keys: ["⌘", "T"], description: "New Query Tab" },
    { keys: ["⌘", "W"], description: "Close Tab" },
    { keys: ["⌘", "1-9"], description: "Switch Tabs" },
    { keys: ["⌘", "Enter"], description: "Run Query" },
  ];

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome</h1>
          <p className="text-muted-foreground">
            {isRedis
              ? "Connected to Redis. Open a console to run commands."
              : isMongoDB
                ? "Connected to MongoDB. Browse collections or add a new document."
                : "Select a table from the sidebar or create a new tab to get started."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {availablePlugins.slice(0, 3).map((plugin) => {
            const Icon = plugin.icon;
            return (
              <motion.button
                key={plugin.type}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCreateTab(plugin.type)}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-xl",
                  "bg-secondary/50 hover:bg-secondary",
                  "border border-border/50 hover:border-border",
                  "transition-colors duration-200",
                  "group cursor-pointer",
                )}
              >
                <div className="p-3 rounded-lg bg-background group-hover:bg-primary/10 transition-colors">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{plugin.displayName}</p>
                  {plugin.createShortcut && (
                    <p className="text-xs text-muted-foreground mt-1">{plugin.createShortcut}</p>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Tables Quick Access */}
        {tables.length > 0 && !isRedis && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Table2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Recent Tables
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {tables.slice(0, 6).map((table) => (
                <motion.button
                  key={`${table.schema}.${table.name}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    createTab(connectionId, paneId, "data", {
                      tableInfo: { schema: table.schema, name: table.name },
                      title: table.name,
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm",
                    "bg-secondary/50 hover:bg-secondary",
                    "border border-border/50 hover:border-border",
                    "text-foreground transition-colors",
                  )}
                >
                  {table.name}
                </motion.button>
              ))}
              {tables.length > 6 && (
                <span className="px-3 py-1.5 text-sm text-muted-foreground">
                  +{tables.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="border-t border-border/50 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Keyboard Shortcuts
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    <kbd
                      key={j}
                      className="px-2 py-0.5 rounded bg-secondary text-foreground text-xs font-mono border border-border/50"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
          <MousePointerClick className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-foreground font-medium">Pro tip</p>
            <p className="text-muted-foreground">
              {isRedis
                ? "Use the Redis Console to run commands like GET, SET, KEYS *, and more."
                : isMongoDB
                  ? "Click on a collection in the sidebar to browse documents, or use the + button to insert new documents."
                  : "Double-click a table in the sidebar to open it in a new tab. Drag tabs to split the view."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
