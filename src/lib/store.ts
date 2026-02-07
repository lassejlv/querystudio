import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection, TableInfo } from "./types";
import { useSettingsStore } from "./settings-store";

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

// Store for AI and Query Editor communication.
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
  aiPanelWidth: number;
  setAiPanelOpen: (open: boolean) => void;
  setAiPanelWidth: (width: number) => void;
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

  // Allow opening multiple connections at the same time (persisted)
  multiConnectionsEnabled: boolean;
  setMultiConnectionsEnabled: (enabled: boolean) => void;

  // Experimental features (persisted)
  experimentalTerminal: boolean;
  setExperimentalTerminal: (enabled: boolean) => void;
  experimentalPlugins: boolean;
  setExperimentalPlugins: (enabled: boolean) => void;

  // Debug settings (persisted)
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;

  // Custom UI font family (persisted)
  customFontFamily: string;
  setCustomFontFamily: (fontFamily: string) => void;

  // Selected row context for AI actions (ephemeral)
  selectedRowsContext: {
    schema: string;
    table: string;
    count: number;
    preview: string;
  } | null;
  setSelectedRowsContext: (context: {
    schema: string;
    table: string;
    count: number;
    preview: string;
  }) => void;
  clearSelectedRowsContext: () => void;
}

export const useAIQueryStore = create<AIQueryState>()((set, get) => ({
  pendingSql: null,
  appendSql: (sql: string) => set({ pendingSql: sql }),
  clearPendingSql: () => set({ pendingSql: null }),

  debugRequest: null,
  requestDebug: (query: string, error: string) => set({ debugRequest: { query, error } }),
  clearDebugRequest: () => set({ debugRequest: null }),

  activeTab: useSettingsStore.getState().activeTab,
  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
    void useSettingsStore.getState().updateSettings({ activeTab: tab });
  },

  aiPanelOpen: useSettingsStore.getState().aiPanelOpen,
  aiPanelWidth: useSettingsStore.getState().aiPanelWidth,
  setAiPanelOpen: (open: boolean) => {
    set({ aiPanelOpen: open });
    void useSettingsStore.getState().updateSettings({ aiPanelOpen: open });
  },
  setAiPanelWidth: (width: number) => {
    set({ aiPanelWidth: width });
    void useSettingsStore.getState().updateSettings({ aiPanelWidth: width });
  },
  toggleAiPanel: () => {
    const next = !get().aiPanelOpen;
    set({ aiPanelOpen: next });
    void useSettingsStore.getState().updateSettings({ aiPanelOpen: next });
  },

  sidebarWidth: useSettingsStore.getState().sidebarWidth,
  sidebarCollapsed: useSettingsStore.getState().sidebarCollapsed,
  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
    void useSettingsStore.getState().updateSettings({ sidebarWidth: width });
  },
  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
    void useSettingsStore.getState().updateSettings({ sidebarCollapsed: collapsed });
  },
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    void useSettingsStore.getState().updateSettings({ sidebarCollapsed: next });
  },

  statusBarVisible: useSettingsStore.getState().statusBarVisible,
  setStatusBarVisible: (visible: boolean) => {
    set({ statusBarVisible: visible });
    void useSettingsStore.getState().updateSettings({ statusBarVisible: visible });
  },
  toggleStatusBar: () => {
    const next = !get().statusBarVisible;
    set({ statusBarVisible: next });
    void useSettingsStore.getState().updateSettings({ statusBarVisible: next });
  },

  autoReconnect: useSettingsStore.getState().autoReconnect,
  setAutoReconnect: (enabled: boolean) => {
    set({ autoReconnect: enabled });
    void useSettingsStore.getState().updateSettings({ autoReconnect: enabled });
  },

  multiConnectionsEnabled: useSettingsStore.getState().multiConnectionsEnabled,
  setMultiConnectionsEnabled: (enabled: boolean) => {
    set({ multiConnectionsEnabled: enabled });
    void useSettingsStore.getState().updateSettings({ multiConnectionsEnabled: enabled });
  },

  experimentalTerminal: useSettingsStore.getState().experimentalTerminal,
  setExperimentalTerminal: (enabled: boolean) => {
    set({ experimentalTerminal: enabled });
    void useSettingsStore.getState().updateSettings({ experimentalTerminal: enabled });
  },

  experimentalPlugins: useSettingsStore.getState().experimentalPlugins,
  setExperimentalPlugins: (enabled: boolean) => {
    set({ experimentalPlugins: enabled });
    void useSettingsStore.getState().updateSettings({ experimentalPlugins: enabled });
  },

  debugMode: useSettingsStore.getState().debugMode,
  setDebugMode: (enabled: boolean) => {
    set({ debugMode: enabled });
    void useSettingsStore.getState().updateSettings({ debugMode: enabled });
  },

  customFontFamily: useSettingsStore.getState().customFontFamily,
  setCustomFontFamily: (fontFamily: string) => {
    set({ customFontFamily: fontFamily });
    void useSettingsStore.getState().updateSettings({ customFontFamily: fontFamily });
  },

  selectedRowsContext: null,
  setSelectedRowsContext: (context) => set({ selectedRowsContext: context }),
  clearSelectedRowsContext: () => set({ selectedRowsContext: null }),
}));

useSettingsStore.subscribe((state) => {
  useAIQueryStore.setState({
    activeTab: state.activeTab,
    aiPanelOpen: state.aiPanelOpen,
    aiPanelWidth: state.aiPanelWidth,
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    statusBarVisible: state.statusBarVisible,
    autoReconnect: state.autoReconnect,
    multiConnectionsEnabled: state.multiConnectionsEnabled,
    experimentalTerminal: state.experimentalTerminal,
    experimentalPlugins: state.experimentalPlugins,
    debugMode: state.debugMode,
    customFontFamily: state.customFontFamily,
  });
});

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
