import { useState, useEffect, useCallback, memo } from "react";
import { Table, LogOut, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useLayoutStore } from "@/lib/layout-store";
import { useShallow } from "zustand/react/shallow";
import { useTables, useDisconnect } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { DatabaseType } from "@/lib/types";

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;

export function DatabaseIcon({ type, className }: { type: DatabaseType; className?: string }) {
  if (type === "mysql") {
    return (
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded bg-orange-500/20 text-xs font-bold text-orange-500",
          className,
        )}
      >
        M
      </span>
    );
  }

  if (type === "sqlite") {
    return (
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded bg-cyan-500/20 text-xs font-bold text-cyan-500",
          className,
        )}
      >
        S
      </span>
    );
  }

  if (type === "redis") {
    return (
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-500/20 text-xs font-bold text-red-500",
          className,
        )}
      >
        R
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500/20 text-xs font-bold text-blue-500",
        className,
      )}
    >
      P
    </span>
  );
}

export const Sidebar = memo(function Sidebar() {
  // Get active connection
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const getActiveConnection = useConnectionStore((s) => s.getActiveConnection);
  const connection = getActiveConnection();

  // Use shallow comparison to minimize re-renders
  const { tables, selectedTable } = useConnectionStore(
    useShallow((s) => ({
      tables: s.tables,
      selectedTable: s.selectedTable,
    })),
  );
  const setTables = useConnectionStore((s) => s.setTables);

  // Layout store for multi-tab support
  const openDataTab = useLayoutStore((s) => s.openDataTab);

  // Sidebar state from store - use shallow comparison
  const { sidebarWidth, sidebarCollapsed } = useAIQueryStore(
    useShallow((s) => ({
      sidebarWidth: s.sidebarWidth,
      sidebarCollapsed: s.sidebarCollapsed,
    })),
  );
  const setSidebarWidth = useAIQueryStore((s) => s.setSidebarWidth);

  const [isResizing, setIsResizing] = useState(false);

  const { data: fetchedTables } = useTables(activeConnectionId);
  const disconnect = useDisconnect(activeConnectionId ?? undefined);

  useEffect(() => {
    if (fetchedTables && fetchedTables !== tables) {
      setTables(fetchedTables);
    }
  }, [fetchedTables, tables, setTables]);

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newWidth = e.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const groupedTables = tables.reduce(
    (acc, table) => {
      if (!acc[table.schema]) {
        acc[table.schema] = [];
      }
      acc[table.schema].push(table);
      return acc;
    },
    {} as Record<string, typeof tables>,
  );

  if (!connection) return null;

  // Collapsed state - show minimal sidebar
  if (sidebarCollapsed) {
    return (
      <motion.div
        initial={{ width: sidebarWidth, opacity: 1 }}
        animate={{ width: 48, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex h-full flex-col border-r border-border bg-card shrink-0"
      >
        {/* Collapsed header */}
        <div className="flex flex-col items-center border-b border-border p-2 gap-2">
          <DatabaseIcon type={connection.db_type || "postgres"} />
        </div>

        {/* Collapsed table list - just icons */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col items-center p-2 gap-1">
            {tables.slice(0, 10).map((table) => (
              <Button
                key={`${table.schema}.${table.name}`}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  selectedTable?.schema === table.schema &&
                    selectedTable?.name === table.name &&
                    "bg-secondary",
                )}
                onClick={() => {
                  if (connection?.id) {
                    openDataTab(connection.id, table.schema, table.name);
                  }
                }}
                title={`${table.schema}.${table.name}`}
              >
                <Table className="h-3 w-3" />
              </Button>
            ))}
            {tables.length > 10 && (
              <span className="text-[10px] text-muted-foreground">+{tables.length - 10}</span>
            )}
          </div>
        </ScrollArea>

        {/* Disconnect button */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => disconnect.mutate()}
            title="Disconnect"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1, width: sidebarWidth }}
        transition={isResizing ? { duration: 0 } : { duration: 0.2, ease: "easeInOut" }}
        className="relative flex h-full flex-col border-r border-border bg-card shrink-0"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/40 z-10"
        />

        {/* Header - traffic lights are above this in the titlebar */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
            <DatabaseIcon type={connection.db_type || "postgres"} />
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="truncate text-sm font-medium text-foreground">
                {connection.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {connection.db_type === "mysql"
                  ? "MySQL"
                  : connection.db_type === "sqlite"
                    ? "SQLite"
                    : connection.db_type === "redis"
                      ? "Redis"
                      : "PostgreSQL"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => disconnect.mutate()}
              title="Disconnect"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-2">
            <AnimatePresence>
              {Object.entries(groupedTables).map(([schema, schemaTables], schemaIdx) => (
                <motion.div
                  key={schema}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: schemaIdx * 0.05 }}
                >
                  <Collapsible defaultOpen={schema === "public"}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-xs text-muted-foreground"
                      >
                        <ChevronRight className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                        {schema}
                        <span className="ml-auto opacity-50">{schemaTables.length}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-3 border-l border-border pl-2">
                        {schemaTables.map((table, tableIdx) => (
                          <motion.div
                            key={`${table.schema}.${table.name}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.15,
                              delay: tableIdx * 0.02,
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "w-full justify-start gap-2 text-xs transition-colors duration-150",
                                selectedTable?.schema === table.schema &&
                                  selectedTable?.name === table.name &&
                                  "bg-secondary",
                              )}
                              onClick={() => {
                                if (connection?.id) {
                                  openDataTab(connection.id, table.schema, table.name);
                                }
                              }}
                              title={`${table.schema}.${table.name}`}
                            >
                              <Table className="h-3 w-3 shrink-0" />
                              <span className="truncate">{table.name}</span>
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
            </AnimatePresence>

            {tables.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 text-center"
              >
                <Table className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No tables found</p>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </>
  );
});
