import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection, TableInfo, LicenseStatus } from "./types";

// Storage keys
const LAST_CONNECTION_KEY = "querystudio_last_connection";
const QUERY_HISTORY_KEY = "querystudio_query_history";
const LAST_CHAT_SESSION_KEY = "querystudio_last_chat_session";

// Theme system now handles dark mode initialization

// Connection state
interface ConnectionState {
  connection: Connection | null;
  tables: TableInfo[];
  selectedTable: { schema: string; name: string } | null;

  setConnection: (connection: Connection | null) => void;
  setTables: (tables: TableInfo[]) => void;
  setSelectedTable: (table: { schema: string; name: string } | null) => void;
  disconnect: () => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  connection: null,
  tables: [],
  selectedTable: null,

  setConnection: (connection: Connection | null) => {
    if (connection) {
      localStorage.setItem(LAST_CONNECTION_KEY, connection.id);
    }
    set({ connection, tables: [], selectedTable: null });
  },

  setTables: (tables: TableInfo[]) => set({ tables }),

  setSelectedTable: (table: { schema: string; name: string } | null) =>
    set({ selectedTable: table }),

  disconnect: () => {
    localStorage.removeItem(LAST_CONNECTION_KEY);
    set({ connection: null, tables: [], selectedTable: null });
  },
}));

// Get last connection ID from localStorage
export function getLastConnectionId(): string | null {
  return localStorage.getItem(LAST_CONNECTION_KEY);
}

// Store for AI and Query Editor communication with persistence for activeTab
interface AIQueryState {
  // SQL to append to query editor
  pendingSql: string | null;
  appendSql: (sql: string) => void;
  clearPendingSql: () => void;

  // Debug request from query editor
  debugRequest: { query: string; error: string } | null;
  requestDebug: (query: string, error: string) => void;
  clearDebugRequest: () => void;

  // Active tab control (persisted)
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // AI Panel visibility (persisted)
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;

  // Sidebar state (persisted)
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Status bar visibility (persisted)
  statusBarVisible: boolean;
  setStatusBarVisible: (visible: boolean) => void;
  toggleStatusBar: () => void;

  // Auto-reconnect to last connection (persisted)
  autoReconnect: boolean;
  setAutoReconnect: (enabled: boolean) => void;
}

export const useAIQueryStore = create<AIQueryState>()(
  persist(
    (set) => ({
      pendingSql: null,
      appendSql: (sql: string) => set({ pendingSql: sql }),
      clearPendingSql: () => set({ pendingSql: null }),

      debugRequest: null,
      requestDebug: (query: string, error: string) =>
        set({ debugRequest: { query, error } }),
      clearDebugRequest: () => set({ debugRequest: null }),

      activeTab: "data",
      setActiveTab: (tab: string) => set({ activeTab: tab }),

      aiPanelOpen: false,
      setAiPanelOpen: (open: boolean) => set({ aiPanelOpen: open }),
      toggleAiPanel: () =>
        set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

      sidebarWidth: 256,
      sidebarCollapsed: false,
      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
      setSidebarCollapsed: (collapsed: boolean) =>
        set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      statusBarVisible: true,
      setStatusBarVisible: (visible: boolean) =>
        set({ statusBarVisible: visible }),
      toggleStatusBar: () =>
        set((state) => ({ statusBarVisible: !state.statusBarVisible })),

      autoReconnect: true,
      setAutoReconnect: (enabled: boolean) => set({ autoReconnect: enabled }),
    }),
    {
      name: "querystudio_ui_state",
      partialize: (state) => ({
        activeTab: state.activeTab,
        aiPanelOpen: state.aiPanelOpen,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        statusBarVisible: state.statusBarVisible,
        autoReconnect: state.autoReconnect,
      }),
    },
  ),
);

// Query history per connection
interface QueryHistoryEntry {
  query: string;
  executedAt: number;
  success: boolean;
  rowCount?: number;
  error?: string;
}

interface QueryHistoryState {
  // Map of connectionId -> query history
  history: Record<string, QueryHistoryEntry[]>;
  addQuery: (
    connectionId: string,
    entry: Omit<QueryHistoryEntry, "executedAt">,
  ) => void;
  getHistory: (connectionId: string) => QueryHistoryEntry[];
  clearHistory: (connectionId: string) => void;

  // Current query per connection (persisted between tab switches)
  currentQueries: Record<string, string>;
  setCurrentQuery: (connectionId: string, query: string) => void;
  getCurrentQuery: (connectionId: string) => string;
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      history: {},
      currentQueries: {},

      addQuery: (
        connectionId: string,
        entry: Omit<QueryHistoryEntry, "executedAt">,
      ) => {
        set((state) => {
          const connectionHistory = state.history[connectionId] || [];
          const newEntry: QueryHistoryEntry = {
            ...entry,
            executedAt: Date.now(),
          };
          // Keep last 100 queries per connection
          const updated = [newEntry, ...connectionHistory].slice(0, 100);
          return {
            history: {
              ...state.history,
              [connectionId]: updated,
            },
          };
        });
      },

      getHistory: (connectionId: string) => {
        return get().history[connectionId] || [];
      },

      clearHistory: (connectionId: string) => {
        set((state) => ({
          history: {
            ...state.history,
            [connectionId]: [],
          },
        }));
      },

      setCurrentQuery: (connectionId: string, query: string) => {
        set((state) => ({
          currentQueries: {
            ...state.currentQueries,
            [connectionId]: query,
          },
        }));
      },

      getCurrentQuery: (connectionId: string) => {
        return get().currentQueries[connectionId] || "";
      },
    }),
    {
      name: QUERY_HISTORY_KEY,
    },
  ),
);

// Last chat session per connection
interface LastChatState {
  // Map of connectionId -> last session ID
  lastSessions: Record<string, string>;
  setLastSession: (connectionId: string, sessionId: string) => void;
  getLastSession: (connectionId: string) => string | null;
}

export const useLastChatStore = create<LastChatState>()(
  persist(
    (set, get) => ({
      lastSessions: {},

      setLastSession: (connectionId: string, sessionId: string) => {
        set((state) => ({
          lastSessions: {
            ...state.lastSessions,
            [connectionId]: sessionId,
          },
        }));
      },

      getLastSession: (connectionId: string) => {
        return get().lastSessions[connectionId] || null;
      },
    }),
    {
      name: LAST_CHAT_SESSION_KEY,
    },
  ),
);

// License state
interface LicenseState {
  status: LicenseStatus | null;
  isLoading: boolean;
  error: string | null;

  setStatus: (status: LicenseStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const defaultLicenseStatus: LicenseStatus = {
  is_activated: false,
  is_pro: false,
  max_connections: 2,
  device_name: null,
};

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      status: null,
      isLoading: false,
      error: null,

      setStatus: (status: LicenseStatus | null) => set({ status, error: null }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error, isLoading: false }),
      clear: () => set({ status: defaultLicenseStatus, error: null }),
    }),
    {
      name: "querystudio_license",
      partialize: (state) => ({
        status: state.status,
      }),
    },
  ),
);
