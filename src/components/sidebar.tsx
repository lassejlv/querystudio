import { useState, useEffect } from "react";
import { Table, LogOut, ChevronRight, Key } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useConnectionStore,
  useAIQueryStore,
  useLicenseStore,
} from "@/lib/store";
import { useTables, useDisconnect } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { LicenseSettings } from "@/components/license-settings";
import type { DatabaseType } from "@/lib/types";

function DatabaseIcon({
  type,
  className,
}: {
  type: DatabaseType;
  className?: string;
}) {
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

export function Sidebar() {
  const connection = useConnectionStore((s) => s.connection);
  const tables = useConnectionStore((s) => s.tables);
  const setTables = useConnectionStore((s) => s.setTables);
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const setSelectedTable = useConnectionStore((s) => s.setSelectedTable);
  const setActiveTab = useAIQueryStore((s) => s.setActiveTab);
  const { status, setStatus } = useLicenseStore();

  const [licenseSettingsOpen, setLicenseSettingsOpen] = useState(false);

  const { data: fetchedTables } = useTables(connection?.id ?? null);
  const disconnect = useDisconnect();

  // Load license status on mount
  useEffect(() => {
    const loadLicenseStatus = async () => {
      try {
        const licenseStatus = await api.licenseGetStatus();
        setStatus(licenseStatus);
      } catch (err) {
        console.error("Failed to load license status:", err);
      }
    };
    loadLicenseStatus();
  }, [setStatus]);

  if (fetchedTables && fetchedTables !== tables) {
    setTables(fetchedTables);
  }

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

  const isPro = status?.is_pro && status?.is_activated;

  if (!connection) return null;

  return (
    <>
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex h-full w-64 flex-col border-r border-border bg-card"
      >
        {/* Header - traffic lights are above this in the titlebar */}
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <DatabaseIcon type={connection.db_type || "postgres"} />
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-foreground">
                {connection.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {connection.db_type === "mysql" ? "MySQL" : "PostgreSQL"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => disconnect.mutate()}
            title="Disconnect"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <AnimatePresence>
              {Object.entries(groupedTables).map(
                ([schema, schemaTables], schemaIdx) => (
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
                          <span className="ml-auto opacity-50">
                            {schemaTables.length}
                          </span>
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
                                  setSelectedTable({
                                    schema: table.schema,
                                    name: table.name,
                                  });
                                  setActiveTab("data");
                                }}
                              >
                                <Table className="h-3 w-3" />
                                <span className="truncate">{table.name}</span>
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </motion.div>
                ),
              )}
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

      <LicenseSettings
        open={licenseSettingsOpen}
        onOpenChange={setLicenseSettingsOpen}
      />
    </>
  );
}
