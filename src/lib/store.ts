import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection, TableInfo } from "./types";

// Storage keys
const LAST_CONNECTION_KEY = "querystudio_last_connection";
const QUERY_HISTORY_KEY = "querystudio_query_history";
const LAST_CHAT_SESSION_KEY = "querystudio_last_chat_session";

// Theme system now handles dark mode initialization

// Connection state
interface ConnectionState {
  activeConnections: Connection[];
  activeConnectionId: string | null;
  tables: TableInfo[];
  selectedTable: { schema: string; name: string } | null;

  addConnection: (connection: Connection) => void;
  removeConnection: (connectionId: string) => void;
  setActiveConnection: (connectionId: string | null) => void;
  setTables: (tables: TableInfo[]) => void;
  setSelectedTable: (table: { schema: string; name: string } | null) => void;
  disconnect: (connectionId?: string) => void;
  disconnectAll: () => void;

  getConnection: (connectionId: string) => Connection | undefined;
  getActiveConnection: () => Connection | null;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  activeConnections: [],
  activeConnectionId: null,
  tables: [],
  selectedTable: null,

  addConnection: (connection: Connection) => {
    set((state) => {
      const exists = state.activeConnections.some((c) => c.id === connection.id);
      if (exists) {
        return { activeConnectionId: connection.id };
      }
      return {
        activeConnections: [...state.activeConnections, connection],
        activeConnectionId: connection.id,
        tables: [],
        selectedTable: null,
      };
    });
    localStorage.setItem(LAST_CONNECTION_KEY, connection.id);
  },

  removeConnection: (connectionId: string) => {
    set((state) => {
      const newConnections = state.activeConnections.filter((c) => c.id !== connectionId);
      let newActiveId = state.activeConnectionId;

      if (state.activeConnectionId === connectionId) {
        newActiveId = newConnections.length > 0 ? newConnections[0].id : null;
      }

      return {
        activeConnections: newConnections,
        activeConnectionId: newActiveId,
        tables: [],
        selectedTable: null,
      };
    });
  },

  setActiveConnection: (connectionId: string | null) => {
    set((state) => {
      if (connectionId === null) {
        return { activeConnectionId: null, tables: [], selectedTable: null };
      }
      const connection = state.activeConnections.find((c) => c.id === connectionId);
      if (connection) {
        localStorage.setItem(LAST_CONNECTION_KEY, connectionId);
        return { activeConnectionId: connectionId, tables: [], selectedTable: null };
      }
      return state;
    });
  },

  setTables: (tables: TableInfo[]) => set({ tables }),

  setSelectedTable: (table: { schema: string; name: string } | null) =>
    set({ selectedTable: table }),

  disconnect: (connectionId?: string) => {
    const targetId = connectionId || get().activeConnectionId;
    if (!targetId) return;

    set((state) => {
      const newConnections = state.activeConnections.filter((c) => c.id !== targetId);
      let newActiveId = state.activeConnectionId;

      if (state.activeConnectionId === targetId) {
        newActiveId = newConnections.length > 0 ? newConnections[0].id : null;
      }

      if (newConnections.length === 0) {
        localStorage.removeItem(LAST_CONNECTION_KEY);
      } else if (newActiveId) {
        localStorage.setItem(LAST_CONNECTION_KEY, newActiveId);
      }

      return {
        activeConnections: newConnections,
        activeConnectionId: newActiveId,
        tables: [],
        selectedTable: null,
      };
    });
  },

  disconnectAll: () => {
    localStorage.removeItem(LAST_CONNECTION_KEY);
    set({
      activeConnections: [],
      activeConnectionId: null,
      tables: [],
      selectedTable: null,
    });
  },

  getConnection: (connectionId: string) => {
    return get().activeConnections.find((c) => c.id === connectionId);
  },

  getActiveConnection: () => {
    const { activeConnections, activeConnectionId } = get();
    if (!activeConnectionId) return null;
    return activeConnections.find((c) => c.id === activeConnectionId) || null;
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

  // Experimental features (persisted)
  experimentalTerminal: boolean;
  setExperimentalTerminal: (enabled: boolean) => void;
  experimentalPlugins: boolean;
  setExperimentalPlugins: (enabled: boolean) => void;

  // Debug settings (persisted)
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
}

export const useAIQueryStore = create<AIQueryState>()(
  persist(
    (set) => ({
      pendingSql: null,
      appendSql: (sql: string) => set({ pendingSql: sql }),
      clearPendingSql: () => set({ pendingSql: null }),

      debugRequest: null,
      requestDebug: (query: string, error: string) => set({ debugRequest: { query, error } }),
      clearDebugRequest: () => set({ debugRequest: null }),

      activeTab: "data",
      setActiveTab: (tab: string) => set({ activeTab: tab }),

      aiPanelOpen: false,
      setAiPanelOpen: (open: boolean) => set({ aiPanelOpen: open }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

      sidebarWidth: 256,
      sidebarCollapsed: false,
      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      statusBarVisible: true,
      setStatusBarVisible: (visible: boolean) => set({ statusBarVisible: visible }),
      toggleStatusBar: () => set((state) => ({ statusBarVisible: !state.statusBarVisible })),

      autoReconnect: true,
      setAutoReconnect: (enabled: boolean) => set({ autoReconnect: enabled }),

      experimentalTerminal: false,
      setExperimentalTerminal: (enabled: boolean) => set({ experimentalTerminal: enabled }),

      experimentalPlugins: false,
      setExperimentalPlugins: (enabled: boolean) => set({ experimentalPlugins: enabled }),

      debugMode: false,
      setDebugMode: (enabled: boolean) => set({ debugMode: enabled }),
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
        experimentalTerminal: state.experimentalTerminal,
        experimentalPlugins: state.experimentalPlugins,
        debugMode: state.debugMode,
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
  addQuery: (connectionId: string, entry: Omit<QueryHistoryEntry, "executedAt">) => void;
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

      addQuery: (connectionId: string, entry: Omit<QueryHistoryEntry, "executedAt">) => {
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
