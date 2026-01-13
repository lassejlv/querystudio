import { useEffect, useState } from "react";
import {
  Database,
  Clock,
  Rows3,
  Table,
  Zap,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useConnectionStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DatabaseType } from "@/lib/types";
import { create } from "zustand";

// Store for status bar state
interface StatusBarState {
  lastQueryTime: number | null;
  lastRowCount: number | null;
  lastQueryStatus: "success" | "error" | null;
  cursorPosition: { line: number; column: number } | null;

  setLastQueryTime: (time: number | null) => void;
  setLastRowCount: (count: number | null) => void;
  setLastQueryStatus: (status: "success" | "error" | null) => void;
  setCursorPosition: (position: { line: number; column: number } | null) => void;
  setQueryResult: (time: number, rowCount: number, success: boolean) => void;
}

export const useStatusBarStore = create<StatusBarState>()((set) => ({
  lastQueryTime: null,
  lastRowCount: null,
  lastQueryStatus: null,
  cursorPosition: null,

  setLastQueryTime: (time) => set({ lastQueryTime: time }),
  setLastRowCount: (count) => set({ lastRowCount: count }),
  setLastQueryStatus: (status) => set({ lastQueryStatus: status }),
  setCursorPosition: (position) => set({ cursorPosition: position }),
  setQueryResult: (time, rowCount, success) =>
    set({
      lastQueryTime: time,
      lastRowCount: rowCount,
      lastQueryStatus: success ? "success" : "error",
    }),
}));

function DatabaseTypeIcon({
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
          "flex h-4 w-4 shrink-0 items-center justify-center rounded bg-orange-500/20 text-[10px] font-bold text-orange-500",
          className
        )}
      >
        M
      </span>
    );
  }
  if (type === "libsql") {
    return (
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded bg-cyan-500/20 text-[10px] font-bold text-cyan-500",
          className
        )}
      >
        L
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded bg-blue-500/20 text-[10px] font-bold text-blue-500",
        className
      )}
    >
      P
    </span>
  );
}

function formatExecutionTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRowCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export function StatusBar() {
  const connection = useConnectionStore((s) => s.connection);
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const tables = useConnectionStore((s) => s.tables);

  const lastQueryTime = useStatusBarStore((s) => s.lastQueryTime);
  const lastRowCount = useStatusBarStore((s) => s.lastRowCount);
  const lastQueryStatus = useStatusBarStore((s) => s.lastQueryStatus);
  const cursorPosition = useStatusBarStore((s) => s.cursorPosition);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = !!connection;

  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-card px-3 text-xs text-muted-foreground">
      {/* Left side - Connection info */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span>Disconnected</span>
            </>
          )}
        </div>

        {/* Database type and name */}
        {connection && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <DatabaseTypeIcon type={connection.db_type} />
              <span className="max-w-[150px] truncate">{connection.name}</span>
            </div>
          </>
        )}

        {/* Table count */}
        {connection && tables.length > 0 && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              <span>
                {tables.length} table{tables.length !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {/* Selected table */}
        {selectedTable && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Table className="h-3 w-3" />
              <span className="max-w-[200px] truncate">
                {selectedTable.schema !== "public"
                  ? `${selectedTable.schema}.${selectedTable.name}`
                  : selectedTable.name}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right side - Query info and cursor */}
      <div className="flex items-center gap-3">
        {/* Last query status */}
        {lastQueryStatus && (
          <div className="flex items-center gap-1.5">
            {lastQueryStatus === "success" ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                lastQueryStatus === "success"
                  ? "text-green-500"
                  : "text-red-500"
              )}
            >
              {lastQueryStatus === "success" ? "Success" : "Error"}
            </span>
          </div>
        )}

        {/* Execution time */}
        {lastQueryTime !== null && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span>{formatExecutionTime(lastQueryTime)}</span>
            </div>
          </>
        )}

        {/* Row count */}
        {lastRowCount !== null && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Rows3 className="h-3 w-3" />
              <span>
                {formatRowCount(lastRowCount)} row
                {lastRowCount !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {/* Cursor position (for query editor) */}
        {cursorPosition && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <span>
                Ln {cursorPosition.line}, Col {cursorPosition.column}
              </span>
            </div>
          </>
        )}

        {/* Current time */}
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
