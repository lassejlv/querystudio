import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection, TableInfo } from "./types";

// Storage keys
const LAST_CONNECTION_KEY = "querystudio_last_connection";
const QUERY_HISTORY_KEY = "querystudio_query_history";
const LAST_CHAT_SESSION_KEY = "querystudio_last_chat_session";
const THEME_KEY = "querystudio_theme";

// Theme types
export type Theme = "dark" | "tokyo-night";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme: Theme) => {
        // Update the document class
        document.documentElement.classList.remove("dark", "tokyo-night");
        document.documentElement.classList.add(theme);
        document.body.classList.remove("dark", "tokyo-night");
        document.body.classList.add(theme);
        set({ theme });
      },
    }),
    {
      name: THEME_KEY,
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state?.theme) {
          document.documentElement.classList.remove("dark", "tokyo-night");
          document.documentElement.classList.add(state.theme);
          document.body.classList.remove("dark", "tokyo-night");
          document.body.classList.add(state.theme);
        }
      },
    }
  )
);

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
    // Save last connection ID when connecting
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
    }),
    {
      name: "querystudio_ui_state",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
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
    }
  )
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
    }
  )
);
