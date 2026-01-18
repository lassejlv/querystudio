import { create } from "zustand";
import { persist } from "zustand/middleware";

// Generate a short unique ID
const generateId = () => crypto.randomUUID().slice(0, 8);

export type TabType = "data" | "query";

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  // For data tabs, store the selected table
  tableInfo?: {
    schema: string;
    name: string;
  };
  // For query tabs, store the query content
  queryContent?: string;
  // Query results for query tabs
  queryResults?: {
    results: Array<{
      columns: string[];
      rows: unknown[][];
      row_count: number;
    }>;
    error: string | null;
    executionTime: number | null;
  };
}

export type SplitDirection = "horizontal" | "vertical";

// A leaf pane contains tabs
export interface LeafPane {
  type: "leaf";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

// A split pane contains two children
export interface SplitPane {
  type: "split";
  id: string;
  direction: SplitDirection;
  first: string; // pane id
  second: string; // pane id
  ratio: number; // 0-1, size of first pane
}

export type Pane = LeafPane | SplitPane;

export type DropZone = "left" | "right" | "top" | "bottom" | "center";

interface LayoutState {
  // Map of connectionId -> root pane id
  rootPaneId: Record<string, string>;
  // Map of connectionId -> all panes
  panes: Record<string, Record<string, Pane>>;
  // Map of connectionId -> active pane id (the one with focus)
  activePaneId: Record<string, string>;

  // Getters
  getRootPane: (connectionId: string) => Pane | null;
  getPane: (connectionId: string, paneId: string) => Pane | null;
  getActivePane: (connectionId: string) => LeafPane | null;
  getAllLeafPanes: (connectionId: string) => LeafPane[];
  getActiveTab: (connectionId: string) => Tab | null;

  // Pane management
  setActivePane: (connectionId: string, paneId: string) => void;
  setActiveTab: (connectionId: string, paneId: string, tabId: string) => void;

  // Tab management within panes
  createTab: (
    connectionId: string,
    paneId: string,
    type: TabType,
    options?: {
      title?: string;
      tableInfo?: { schema: string; name: string };
      queryContent?: string;
      makeActive?: boolean;
    },
  ) => string;
  closeTab: (connectionId: string, paneId: string, tabId: string) => void;
  updateTab: (
    connectionId: string,
    paneId: string,
    tabId: string,
    updates: Partial<Omit<Tab, "id">>,
  ) => void;
  reorderTabs: (
    connectionId: string,
    paneId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;

  // Split operations
  splitPane: (
    connectionId: string,
    paneId: string,
    direction: SplitDirection,
    tabId?: string, // if provided, move this tab to the new pane
  ) => string; // returns new pane id

  moveTabToPane: (
    connectionId: string,
    fromPaneId: string,
    tabId: string,
    toPaneId: string,
    dropZone: DropZone,
  ) => void;

  closePane: (connectionId: string, paneId: string) => void;
  resizePane: (connectionId: string, splitPaneId: string, ratio: number) => void;

  // Open or focus a data tab for a specific table
  openDataTab: (connectionId: string, schema: string, name: string) => string;

  // Initialize default layout if none exists
  initializeLayout: (connectionId: string, dbType?: string) => void;

  // Clear layout for a connection
  clearLayout: (connectionId: string) => void;
}

const createDefaultLeafPane = (dbType?: string): LeafPane => {
  const isRedis = dbType === "redis";
  const dataTab: Tab = {
    id: generateId(),
    type: "data",
    title: isRedis ? "Keys" : "Data",
  };
  const queryTab: Tab = {
    id: generateId(),
    type: "query",
    title: isRedis ? "Console" : "Query",
    queryContent: "",
  };

  return {
    type: "leaf",
    id: generateId(),
    tabs: [dataTab, queryTab],
    activeTabId: dataTab.id,
  };
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      rootPaneId: {},
      panes: {},
      activePaneId: {},

      getRootPane: (connectionId: string) => {
        const rootId = get().rootPaneId[connectionId];
        if (!rootId) return null;
        return get().panes[connectionId]?.[rootId] || null;
      },

      getPane: (connectionId: string, paneId: string) => {
        return get().panes[connectionId]?.[paneId] || null;
      },

      getActivePane: (connectionId: string) => {
        const activePaneId = get().activePaneId[connectionId];
        if (!activePaneId) return null;
        const pane = get().panes[connectionId]?.[activePaneId];
        if (!pane || pane.type !== "leaf") return null;
        return pane;
      },

      getAllLeafPanes: (connectionId: string) => {
        const allPanes = get().panes[connectionId] || {};
        return Object.values(allPanes).filter(
          (p): p is LeafPane => p.type === "leaf",
        );
      },

      getActiveTab: (connectionId: string) => {
        const activePane = get().getActivePane(connectionId);
        if (!activePane) return null;
        return (
          activePane.tabs.find((t) => t.id === activePane.activeTabId) || null
        );
      },

      setActivePane: (connectionId: string, paneId: string) => {
        set((state) => ({
          activePaneId: {
            ...state.activePaneId,
            [connectionId]: paneId,
          },
        }));
      },

      setActiveTab: (connectionId: string, paneId: string, tabId: string) => {
        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[paneId];
          if (!pane || pane.type !== "leaf") return state;

          return {
            panes: {
              ...state.panes,
              [connectionId]: {
                ...panes,
                [paneId]: {
                  ...pane,
                  activeTabId: tabId,
                },
              },
            },
            activePaneId: {
              ...state.activePaneId,
              [connectionId]: paneId,
            },
          };
        });
      },

      createTab: (connectionId, paneId, type, options = {}) => {
        const tabId = generateId();

        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[paneId];
          if (!pane || pane.type !== "leaf") return state;

          const sameTypeTabs = pane.tabs.filter((t) => t.type === type);
          const defaultTitle =
            type === "query"
              ? `Query ${sameTypeTabs.length + 1}`
              : `Data ${sameTypeTabs.length + 1}`;

          const newTab: Tab = {
            id: tabId,
            type,
            title: options.title || defaultTitle,
            tableInfo: options.tableInfo,
            queryContent:
              options.queryContent ?? (type === "query" ? "" : undefined),
          };

          const newPane: LeafPane = {
            ...pane,
            tabs: [...pane.tabs, newTab],
            activeTabId:
              options.makeActive !== false ? tabId : pane.activeTabId,
          };

          return {
            panes: {
              ...state.panes,
              [connectionId]: {
                ...panes,
                [paneId]: newPane,
              },
            },
            activePaneId:
              options.makeActive !== false
                ? {
                    ...state.activePaneId,
                    [connectionId]: paneId,
                  }
                : state.activePaneId,
          };
        });

        return tabId;
      },

      closeTab: (connectionId, paneId, tabId) => {
        const state = get();
        const panes = state.panes[connectionId] || {};
        const pane = panes[paneId];
        if (!pane || pane.type !== "leaf") return;

        const newTabs = pane.tabs.filter((t) => t.id !== tabId);

        // If no tabs left, close the pane
        if (newTabs.length === 0) {
          get().closePane(connectionId, paneId);
          return;
        }

        // Update active tab if needed
        let newActiveTabId = pane.activeTabId;
        if (pane.activeTabId === tabId) {
          const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
          const newIndex = Math.max(0, tabIndex - 1);
          newActiveTabId = newTabs[newIndex]?.id || newTabs[0]?.id || null;
        }

        set((state) => ({
          panes: {
            ...state.panes,
            [connectionId]: {
              ...state.panes[connectionId],
              [paneId]: {
                ...pane,
                tabs: newTabs,
                activeTabId: newActiveTabId,
              },
            },
          },
        }));
      },

      updateTab: (connectionId, paneId, tabId, updates) => {
        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[paneId];
          if (!pane || pane.type !== "leaf") return state;

          return {
            panes: {
              ...state.panes,
              [connectionId]: {
                ...panes,
                [paneId]: {
                  ...pane,
                  tabs: pane.tabs.map((t) =>
                    t.id === tabId ? { ...t, ...updates } : t,
                  ),
                },
              },
            },
          };
        });
      },

      reorderTabs: (connectionId, paneId, fromIndex, toIndex) => {
        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[paneId];
          if (!pane || pane.type !== "leaf") return state;

          if (
            fromIndex < 0 ||
            fromIndex >= pane.tabs.length ||
            toIndex < 0 ||
            toIndex >= pane.tabs.length ||
            fromIndex === toIndex
          ) {
            return state;
          }

          const newTabs = [...pane.tabs];
          const [movedTab] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, movedTab);

          return {
            panes: {
              ...state.panes,
              [connectionId]: {
                ...panes,
                [paneId]: {
                  ...pane,
                  tabs: newTabs,
                },
              },
            },
          };
        });
      },

      splitPane: (connectionId, paneId, direction, tabId) => {
        const newPaneId = generateId();
        const splitId = generateId();

        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[paneId];
          if (!pane || pane.type !== "leaf") return state;

          // Create new leaf pane
          let newPane: LeafPane;
          let updatedOriginalPane: LeafPane = pane;

          if (tabId) {
            // Move the specified tab to the new pane
            const tab = pane.tabs.find((t) => t.id === tabId);
            if (!tab) return state;

            newPane = {
              type: "leaf",
              id: newPaneId,
              tabs: [tab],
              activeTabId: tab.id,
            };

            // Remove tab from original pane
            const remainingTabs = pane.tabs.filter((t) => t.id !== tabId);
            if (remainingTabs.length === 0) {
              // Can't split if original pane would be empty
              return state;
            }

            updatedOriginalPane = {
              ...pane,
              tabs: remainingTabs,
              activeTabId:
                pane.activeTabId === tabId
                  ? remainingTabs[0]?.id || null
                  : pane.activeTabId,
            };
          } else {
            // Create empty new pane with a default tab
            const defaultTab: Tab = {
              id: generateId(),
              type: "data",
              title: "Data",
            };
            newPane = {
              type: "leaf",
              id: newPaneId,
              tabs: [defaultTab],
              activeTabId: defaultTab.id,
            };
          }

          // Create split pane
          const splitPane: SplitPane = {
            type: "split",
            id: splitId,
            direction,
            first: paneId,
            second: newPaneId,
            ratio: 0.5,
          };

          // Update parent references
          const rootId = state.rootPaneId[connectionId];
          let newRootId = rootId;
          const newPanes = { ...panes };

          // Find and update parent split that references this pane
          const updateParentReference = (oldPaneId: string, newPaneId: string) => {
            for (const [id, p] of Object.entries(newPanes)) {
              if (p.type === "split") {
                if (p.first === oldPaneId) {
                  newPanes[id] = { ...p, first: newPaneId };
                } else if (p.second === oldPaneId) {
                  newPanes[id] = { ...p, second: newPaneId };
                }
              }
            }
          };

          if (rootId === paneId) {
            // Original pane was root, make split the new root
            newRootId = splitId;
          } else {
            // Update parent to point to split instead of original pane
            updateParentReference(paneId, splitId);
          }

          newPanes[paneId] = updatedOriginalPane;
          newPanes[newPaneId] = newPane;
          newPanes[splitId] = splitPane;

          return {
            rootPaneId: {
              ...state.rootPaneId,
              [connectionId]: newRootId,
            },
            panes: {
              ...state.panes,
              [connectionId]: newPanes,
            },
            activePaneId: {
              ...state.activePaneId,
              [connectionId]: tabId ? newPaneId : paneId,
            },
          };
        });

        return newPaneId;
      },

      moveTabToPane: (connectionId, fromPaneId, tabId, toPaneId, dropZone) => {
        const state = get();
        const panes = state.panes[connectionId] || {};
        const fromPane = panes[fromPaneId];
        const toPane = panes[toPaneId];

        if (!fromPane || fromPane.type !== "leaf") return;
        if (!toPane || toPane.type !== "leaf") return;

        const tab = fromPane.tabs.find((t) => t.id === tabId);
        if (!tab) return;

        if (dropZone === "center") {
          // Just move the tab to the target pane
          if (fromPaneId === toPaneId) return;

          // Remove from source
          const newFromTabs = fromPane.tabs.filter((t) => t.id !== tabId);

          // If source pane is empty, close it
          if (newFromTabs.length === 0) {
            // First add tab to target, then close source
            set((state) => {
              const panes = state.panes[connectionId] || {};
              return {
                panes: {
                  ...state.panes,
                  [connectionId]: {
                    ...panes,
                    [toPaneId]: {
                      ...toPane,
                      tabs: [...toPane.tabs, tab],
                      activeTabId: tabId,
                    },
                  },
                },
              };
            });
            get().closePane(connectionId, fromPaneId);
          } else {
            set((state) => {
              const panes = state.panes[connectionId] || {};
              return {
                panes: {
                  ...state.panes,
                  [connectionId]: {
                    ...panes,
                    [fromPaneId]: {
                      ...fromPane,
                      tabs: newFromTabs,
                      activeTabId:
                        fromPane.activeTabId === tabId
                          ? newFromTabs[0]?.id || null
                          : fromPane.activeTabId,
                    },
                    [toPaneId]: {
                      ...toPane,
                      tabs: [...toPane.tabs, tab],
                      activeTabId: tabId,
                    },
                  },
                },
                activePaneId: {
                  ...state.activePaneId,
                  [connectionId]: toPaneId,
                },
              };
            });
          }
        } else {
          // Create a split
          const direction: SplitDirection =
            dropZone === "left" || dropZone === "right"
              ? "horizontal"
              : "vertical";

          // If dragging within same pane with only one tab, do nothing
          if (fromPaneId === toPaneId && fromPane.tabs.length === 1) {
            return;
          }

          get().splitPane(connectionId, toPaneId, direction, undefined);

          // The split was created, now we need to move the tab
          // This is a bit complex, let's just remove from source and add to new pane
          const newState = get();
          const newPanes = newState.panes[connectionId] || {};

          // Find the newly created leaf pane (second child of the new split)
          const toSplit = Object.values(newPanes).find(
            (p): p is SplitPane =>
              p.type === "split" &&
              (p.first === toPaneId || p.second === toPaneId),
          );

          if (toSplit) {
            const newPaneId =
              dropZone === "right" || dropZone === "bottom"
                ? toSplit.second
                : toSplit.first;

            // Swap if needed based on drop zone
            if (dropZone === "left" || dropZone === "top") {
              set((state) => ({
                panes: {
                  ...state.panes,
                  [connectionId]: {
                    ...state.panes[connectionId],
                    [toSplit.id]: {
                      ...toSplit,
                      first: toSplit.second,
                      second: toSplit.first,
                    },
                  },
                },
              }));
            }

            // Now move the tab to the new pane
            if (fromPaneId !== toPaneId) {
              get().moveTabToPane(
                connectionId,
                fromPaneId,
                tabId,
                newPaneId,
                "center",
              );
            }
          }
        }
      },

      closePane: (connectionId, paneId) => {
        set((state) => {
          const panes = state.panes[connectionId] || {};
          const rootId = state.rootPaneId[connectionId];

          // Can't close root if it's the only pane
          if (paneId === rootId && Object.keys(panes).length === 1) {
            return state;
          }

          // Find parent split
          let parentSplit: SplitPane | null = null;
          let siblingId: string | null = null;

          for (const p of Object.values(panes)) {
            if (p.type === "split") {
              if (p.first === paneId) {
                parentSplit = p;
                siblingId = p.second;
                break;
              } else if (p.second === paneId) {
                parentSplit = p;
                siblingId = p.first;
                break;
              }
            }
          }

          if (!parentSplit || !siblingId) {
            // This is the root pane, can't close
            return state;
          }

          const newPanes = { ...panes };

          // Remove the pane and the parent split
          delete newPanes[paneId];
          delete newPanes[parentSplit.id];

          // Update grandparent to point to sibling
          let newRootId = rootId;

          if (rootId === parentSplit.id) {
            // Parent split was root, sibling becomes new root
            newRootId = siblingId;
          } else {
            // Update grandparent reference
            for (const [id, p] of Object.entries(newPanes)) {
              if (p.type === "split") {
                if (p.first === parentSplit.id) {
                  newPanes[id] = { ...p, first: siblingId };
                } else if (p.second === parentSplit.id) {
                  newPanes[id] = { ...p, second: siblingId };
                }
              }
            }
          }

          // Update active pane if needed
          let newActivePaneId = state.activePaneId[connectionId];
          if (newActivePaneId === paneId) {
            // Find first available leaf pane
            const siblingPane = newPanes[siblingId];
            if (siblingPane?.type === "leaf") {
              newActivePaneId = siblingId;
            } else {
              // Find any leaf pane
              const leafPane = Object.values(newPanes).find(
                (p): p is LeafPane => p.type === "leaf",
              );
              newActivePaneId = leafPane?.id || siblingId;
            }
          }

          return {
            rootPaneId: {
              ...state.rootPaneId,
              [connectionId]: newRootId,
            },
            panes: {
              ...state.panes,
              [connectionId]: newPanes,
            },
            activePaneId: {
              ...state.activePaneId,
              [connectionId]: newActivePaneId,
            },
          };
        });
      },

      resizePane: (connectionId, splitPaneId, ratio) => {
        set((state) => {
          const panes = state.panes[connectionId] || {};
          const pane = panes[splitPaneId];
          if (!pane || pane.type !== "split") return state;

          const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));

          return {
            panes: {
              ...state.panes,
              [connectionId]: {
                ...panes,
                [splitPaneId]: {
                  ...pane,
                  ratio: clampedRatio,
                },
              },
            },
          };
        });
      },

      openDataTab: (connectionId, schema, name) => {
        const state = get();
        const leafPanes = state.getAllLeafPanes(connectionId);

        // Check if a data tab for this table already exists in any pane
        for (const pane of leafPanes) {
          const existingTab = pane.tabs.find(
            (t) =>
              t.type === "data" &&
              t.tableInfo?.schema === schema &&
              t.tableInfo?.name === name,
          );

          if (existingTab) {
            get().setActiveTab(connectionId, pane.id, existingTab.id);
            return existingTab.id;
          }
        }

        // Create a new data tab in the active pane
        const activePane = state.getActivePane(connectionId);
        if (!activePane) {
          // Initialize layout if needed
          get().initializeLayout(connectionId);
          const newActivePane = get().getActivePane(connectionId);
          if (!newActivePane) return "";

          return get().createTab(connectionId, newActivePane.id, "data", {
            title: `${schema}.${name}`,
            tableInfo: { schema, name },
            makeActive: true,
          });
        }

        return get().createTab(connectionId, activePane.id, "data", {
          title: `${schema}.${name}`,
          tableInfo: { schema, name },
          makeActive: true,
        });
      },

      initializeLayout: (connectionId, dbType) => {
        const existingRoot = get().rootPaneId[connectionId];
        if (existingRoot) return;

        const defaultPane = createDefaultLeafPane(dbType);

        set((state) => ({
          rootPaneId: {
            ...state.rootPaneId,
            [connectionId]: defaultPane.id,
          },
          panes: {
            ...state.panes,
            [connectionId]: {
              [defaultPane.id]: defaultPane,
            },
          },
          activePaneId: {
            ...state.activePaneId,
            [connectionId]: defaultPane.id,
          },
        }));
      },

      clearLayout: (connectionId) => {
        set((state) => {
          const { [connectionId]: _root, ...restRoots } = state.rootPaneId;
          const { [connectionId]: _panes, ...restPanes } = state.panes;
          const { [connectionId]: _active, ...restActive } = state.activePaneId;

          return {
            rootPaneId: restRoots,
            panes: restPanes,
            activePaneId: restActive,
          };
        });
      },
    }),
    {
      name: "querystudio_layout",
      partialize: (state) => ({
        rootPaneId: state.rootPaneId,
        panes: state.panes,
        activePaneId: state.activePaneId,
      }),
    },
  ),
);
