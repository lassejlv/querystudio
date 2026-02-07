import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  TerminalSquare,
  LogIn,
  LogOut,
  Settings,
  RefreshCw,
  PencilLine,
} from "lucide-react";
import { useConnectionStore, useAIQueryStore } from "@/lib/store";
import { useLayoutStore } from "@/lib/layout-store";
import { authClient, signInWithGithub } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { DatabaseType } from "@/lib/types";
import { create } from "zustand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Store for status bar state
interface StatusBarState {
  lastQueryTime: number | null;
  lastRowCount: number | null;
  lastQueryStatus: "success" | "error" | null;
  cursorPosition: { line: number; column: number } | null;
  lastDataRefreshAt: number | null;
  lastDataFetchDurationMs: number | null;
  hasUnsavedEdits: boolean;

  setLastQueryTime: (time: number | null) => void;
  setLastRowCount: (count: number | null) => void;
  setLastQueryStatus: (status: "success" | "error" | null) => void;
  setCursorPosition: (position: { line: number; column: number } | null) => void;
  setLastDataRefreshAt: (time: number | null) => void;
  setLastDataFetchDurationMs: (ms: number | null) => void;
  setHasUnsavedEdits: (dirty: boolean) => void;
  setQueryResult: (time: number, rowCount: number, success: boolean) => void;
}

export const useStatusBarStore = create<StatusBarState>()((set) => ({
  lastQueryTime: null,
  lastRowCount: null,
  lastQueryStatus: null,
  cursorPosition: null,
  lastDataRefreshAt: null,
  lastDataFetchDurationMs: null,
  hasUnsavedEdits: false,

  setLastQueryTime: (time) => set({ lastQueryTime: time }),
  setLastRowCount: (count) => set({ lastRowCount: count }),
  setLastQueryStatus: (status) => set({ lastQueryStatus: status }),
  setCursorPosition: (position) => set({ cursorPosition: position }),
  setLastDataRefreshAt: (time) => set({ lastDataRefreshAt: time }),
  setLastDataFetchDurationMs: (ms) => set({ lastDataFetchDurationMs: ms }),
  setHasUnsavedEdits: (dirty) => set({ hasUnsavedEdits: dirty }),
  setQueryResult: (time, rowCount, success) =>
    set({
      lastQueryTime: time,
      lastRowCount: rowCount,
      lastQueryStatus: success ? "success" : "error",
    }),
}));

function DatabaseTypeIcon({ type, className }: { type: DatabaseType; className?: string }) {
  if (type === "mysql") {
    return (
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-orange-400/25 bg-orange-500/12 text-[10px] font-bold text-orange-300",
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
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-500/12 text-[10px] font-bold text-cyan-300",
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
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-red-400/25 bg-red-500/12 text-[10px] font-bold text-red-300",
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
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-blue-400/25 bg-blue-500/12 text-[10px] font-bold text-blue-300",
        className,
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

function formatTimeSince(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}

export function StatusBar() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.getActiveConnection());
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const selectedTable = useConnectionStore((s) => s.selectedTable);
  const tables = useConnectionStore((s) => s.tables);

  const lastQueryTime = useStatusBarStore((s) => s.lastQueryTime);
  const lastRowCount = useStatusBarStore((s) => s.lastRowCount);
  const lastQueryStatus = useStatusBarStore((s) => s.lastQueryStatus);
  const cursorPosition = useStatusBarStore((s) => s.cursorPosition);
  const lastDataRefreshAt = useStatusBarStore((s) => s.lastDataRefreshAt);
  const lastDataFetchDurationMs = useStatusBarStore((s) => s.lastDataFetchDurationMs);
  const hasUnsavedEdits = useStatusBarStore((s) => s.hasUnsavedEdits);

  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);

  // Auth status
  const session = authClient.useSession();

  // Get terminal tabs count and create function from layout store
  const connectionId = activeConnectionId ?? "";
  const getActivePane = useLayoutStore((s) => s.getActivePane);
  const getAllLeafPanes = useLayoutStore((s) => s.getAllLeafPanes);
  const createTab = useLayoutStore((s) => s.createTab);

  // Count terminal tabs across all panes
  const terminalTabCount = connectionId
    ? getAllLeafPanes(connectionId).reduce(
        (count, pane) => count + pane.tabs.filter((t) => t.type === "terminal").length,
        0,
      )
    : 0;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isConnected = !!connection;
  const isCompact = viewportWidth < 1250;
  const isVeryCompact = viewportWidth < 980;

  const handleTerminalClick = useCallback(() => {
    if (!connectionId) return;

    // Get the active pane or first leaf pane
    const activePane = getActivePane(connectionId);
    if (activePane) {
      createTab(connectionId, activePane.id, "terminal", {
        makeActive: true,
      });
    }
  }, [connectionId, getActivePane, createTab]);

  const handleOpenSettings = useCallback(() => {
    void navigate({ to: "/settings" });
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    try {
      await authClient.signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGithub();
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error("Failed to sign in with GitHub");
    }
  }, []);

  return (
    <div className="flex h-7 items-center justify-between border-t border-border/70 bg-gradient-to-b from-card to-card/92 px-2.5 text-[11px] text-muted-foreground/90 supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur-sm">
      {/* Left side - Connection info */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5">
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-300">{isCompact ? "Online" : "Connected"}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span>{isCompact ? "Offline" : "Disconnected"}</span>
            </>
          )}
        </div>

        {/* Database type and name */}
        {connection && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5">
              <DatabaseTypeIcon type={connection.db_type} />
              <span
                className={cn(
                  "truncate text-foreground/90",
                  isVeryCompact ? "max-w-[90px]" : isCompact ? "max-w-[120px]" : "max-w-[170px]",
                )}
              >
                {connection.name}
              </span>
            </div>
          </>
        )}

        {/* Table count */}
        {connection && tables.length > 0 && !isCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <Database className="h-3 w-3" />
              <span>
                {tables.length} table{tables.length !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {/* Selected table */}
        {selectedTable && !isVeryCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <Table className="h-3 w-3" />
              <span className="max-w-[180px] truncate">
                {selectedTable.schema !== "public"
                  ? `${selectedTable.schema}.${selectedTable.name}`
                  : selectedTable.name}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right side - Query info and cursor */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Last query status */}
        {lastQueryStatus && (
          <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5">
            {lastQueryStatus === "success" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            ) : (
              <XCircle className="h-3 w-3 text-red-400" />
            )}
            <span
              className={cn(lastQueryStatus === "success" ? "text-emerald-300" : "text-red-300")}
            >
              {lastQueryStatus === "success" ? "Success" : "Error"}
            </span>
          </div>
        )}

        {/* Execution time */}
        {lastQueryTime !== null && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>{formatExecutionTime(lastQueryTime)}</span>
            </div>
          </>
        )}

        {/* Row count */}
        {lastRowCount !== null && !isVeryCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <Rows3 className="h-3 w-3" />
              <span>
                {formatRowCount(lastRowCount)} row
                {lastRowCount !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {/* Data refresh timestamp */}
        {lastDataRefreshAt !== null && !isVeryCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <RefreshCw className="h-3 w-3 text-sky-300" />
              <span>{formatTimeSince(lastDataRefreshAt)}</span>
            </div>
          </>
        )}

        {/* Data refresh latency */}
        {lastDataFetchDurationMs !== null && !isCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5">
              <Zap className="h-3 w-3 text-sky-300" />
              <span>{formatExecutionTime(lastDataFetchDurationMs)}</span>
            </div>
          </>
        )}

        {/* Unsaved edits */}
        {hasUnsavedEdits && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-200">
              <PencilLine className="h-3 w-3" />
              <span>Unsaved edits</span>
            </div>
          </>
        )}

        {/* Cursor position (for query editor) */}
        {cursorPosition && !isCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5 font-mono">
              <span>
                Ln {cursorPosition.line}, Col {cursorPosition.column}
              </span>
            </div>
          </>
        )}

        {/* Terminal button - only shown when experimental terminal is enabled */}
        {experimentalTerminal && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleTerminalClick}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-border/60 bg-background/35 px-1.5 py-0.5 transition-colors hover:bg-accent/70 hover:text-accent-foreground",
                      terminalTabCount > 0 && "border-primary/40 text-primary",
                    )}
                  >
                    <TerminalSquare className="h-3 w-3" />
                    {terminalTabCount > 0 && !isVeryCompact && (
                      <span className="text-[10px]">{terminalTabCount}</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  New Terminal Tab
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Auth status */}
        <div className="h-3 w-px bg-border/70" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center rounded-full border border-border/60 p-0.5 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {session.data?.user ? (
                <>
                  {session.data.user.image ? (
                    <img
                      src={session.data.user.image}
                      alt={session.data.user.name || "User"}
                      className="h-4 w-4 rounded-full"
                    />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-medium text-primary">
                      {session.data.user.name?.charAt(0).toUpperCase() ||
                        session.data.user.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-[8px] text-muted-foreground">?</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            {session.data?.user ? (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="truncate text-sm font-medium">
                      {session.data.user.name || "Signed in"}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {session.data.user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleOpenSettings}>
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>Not signed in</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleOpenSettings}>
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignIn()}>
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In with GitHub
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Current time */}
        {!isVeryCompact && (
          <>
            <div className="h-3 w-px bg-border/70" />
            <div className="flex items-center gap-1.5 rounded-md bg-background/35 px-1.5 py-0.5 font-mono">
              <Clock className="h-3 w-3" />
              <span>
                {currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
