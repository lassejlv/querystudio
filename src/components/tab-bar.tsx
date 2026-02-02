import { useState, useRef, useEffect, memo, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIQueryStore } from "@/lib/store";
import { tabRegistry, type TabPlugin } from "@/lib/tab-sdk";
import { usePluginStore } from "@/lib/plugin-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useLayoutStore, type Tab, type TabType, type DropZone } from "@/lib/layout-store";
import { useShallow } from "zustand/react/shallow";

interface TabBarProps {
  connectionId: string;
  dbType?: string;
  paneId: string;
}

export const TabBar = memo(function TabBar({ connectionId, dbType, paneId }: TabBarProps) {
  const isRedis = dbType === "redis";

  // Use shallow comparison for better performance - only re-render when relevant data changes
  const { tabs, activeTabId } = useLayoutStore(
    useShallow((s) => {
      const panes = s.panes[connectionId] || {};
      const pane = panes[paneId];
      return {
        tabs: pane?.type === "leaf" ? pane.tabs : [],
        activeTabId: pane?.type === "leaf" ? pane.activeTabId : null,
      };
    }),
  );

  const activePaneId = useLayoutStore((s) => s.activePaneId[connectionId]);
  const isActivePane = activePaneId === paneId;

  // Get actions from the store - these are stable references
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const createTab = useLayoutStore((s) => s.createTab);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const updateTab = useLayoutStore((s) => s.updateTab);
  const reorderTabs = useLayoutStore((s) => s.reorderTabs);
  const splitPane = useLayoutStore((s) => s.splitPane);
  const moveTabToPane = useLayoutStore((s) => s.moveTabToPane);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DropZone | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (editingTabId !== tabId) {
        setActiveTab(connectionId, paneId, tabId);
      }
    },
    [editingTabId, setActiveTab, connectionId, paneId],
  );

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(connectionId, paneId, tabId);
    },
    [closeTab, connectionId, paneId],
  );

  const handleDoubleClick = useCallback((tab: Tab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  }, []);

  const handleTitleSave = useCallback(() => {
    if (editingTabId && editingTitle.trim()) {
      updateTab(connectionId, paneId, editingTabId, {
        title: editingTitle.trim(),
      });
    }
    setEditingTabId(null);
    setEditingTitle("");
  }, [editingTabId, editingTitle, updateTab, connectionId, paneId]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTitleSave();
      } else if (e.key === "Escape") {
        setEditingTabId(null);
        setEditingTitle("");
      }
    },
    [handleTitleSave],
  );

  const handleCreateTab = useCallback(
    (type: TabType) => {
      const title = type === "query" ? (isRedis ? "Console" : "Query") : isRedis ? "Keys" : "Data";
      createTab(connectionId, paneId, type, { title });
    },
    [isRedis, createTab, connectionId, paneId],
  );

  const handleCloseOtherTabs = useCallback(
    (tabId: string) => {
      const tabsToClose = tabs.filter((t) => t.id !== tabId);
      tabsToClose.forEach((t) => closeTab(connectionId, paneId, t.id));
    },
    [tabs, closeTab, connectionId, paneId],
  );

  const handleCloseTabsToRight = useCallback(
    (tabId: string) => {
      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      const tabsToClose = tabs.slice(tabIndex + 1);
      tabsToClose.forEach((t) => closeTab(connectionId, paneId, t.id));
    },
    [tabs, closeTab, connectionId, paneId],
  );

  const handleDuplicateTab = useCallback(
    (tab: Tab) => {
      // For terminal tabs, don't copy terminalId - a new one will be created
      createTab(connectionId, paneId, tab.type, {
        title: `${tab.title} (copy)`,
        tableInfo: tab.tableInfo,
        queryContent: tab.queryContent,
        // Don't pass terminalId - let the terminal tab create a new terminal
        metadata: tab.type === "terminal" ? undefined : tab.metadata,
      });
    },
    [createTab, connectionId, paneId],
  );

  const handleSplitRight = useCallback(
    (tabId: string) => {
      splitPane(connectionId, paneId, "horizontal", tabId);
    },
    [splitPane, connectionId, paneId],
  );

  const handleSplitDown = useCallback(
    (tabId: string) => {
      splitPane(connectionId, paneId, "vertical", tabId);
    },
    [splitPane, connectionId, paneId],
  );

  const experimentalTerminal = useAIQueryStore((s) => s.experimentalTerminal);

  // Get plugin enabled states from plugin store
  const installedPlugins = usePluginStore((s) => s.plugins);

  // Get creatable plugins from Tab SDK, filtered by enabled state in plugin store
  // Also filter by database type if the plugin has database restrictions
  const creatablePlugins = useMemo(() => {
    const allCreatable = tabRegistry.getCreatable(experimentalTerminal, dbType);

    // Filter out plugins that are disabled in the plugin store
    return allCreatable.filter((plugin) => {
      const installedPlugin = installedPlugins.find((p) => p.type === plugin.type);
      return !installedPlugin || installedPlugin.enabled;
    });
  }, [experimentalTerminal, installedPlugins, dbType]);

  const getTabIcon = useCallback((type: TabType) => {
    const plugin = tabRegistry.get(type);
    if (plugin) {
      const Icon = plugin.icon;
      return <Icon className="h-3.5 w-3.5 shrink-0" />;
    }
    return null;
  }, []);

  // Native HTML5 drag and drop handlers
  const handleTabDragStart = (e: React.DragEvent, tab: Tab) => {
    setDraggingTabId(tab.id);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ tabId: tab.id, fromPaneId: paneId }),
    );
    e.dataTransfer.effectAllowed = "move";

    // Create a custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    dragImage.style.opacity = "0.8";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 50, 18);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleTabDragEnd = () => {
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDragOverPosition(null);
    setDragOverZone(null);
  };

  const handleTabDragOver = (e: React.DragEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const midpoint = rect.width / 2;

    setDragOverTabId(tab.id);
    setDragOverPosition(x < midpoint ? "before" : "after");
    setDragOverZone(null);
  };

  const handleTabDrop = (e: React.DragEvent, targetTab: Tab) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData("application/json");
    if (!data) {
      handleTabDragEnd();
      return;
    }

    try {
      const { tabId, fromPaneId } = JSON.parse(data);

      if (fromPaneId === paneId) {
        // Reordering within same pane
        const fromIndex = tabs.findIndex((t) => t.id === tabId);
        let toIndex = tabs.findIndex((t) => t.id === targetTab.id);

        if (dragOverPosition === "after") {
          toIndex = toIndex + 1;
        }

        if (fromIndex !== -1 && fromIndex !== toIndex) {
          // Adjust toIndex if moving forward
          if (fromIndex < toIndex) {
            toIndex = toIndex - 1;
          }
          reorderTabs(connectionId, paneId, fromIndex, toIndex);
        }
      } else {
        // Moving from another pane - add to this pane at the target position
        moveTabToPane(connectionId, fromPaneId, tabId, paneId, "center");
      }
    } catch {
      // Invalid data
    }

    handleTabDragEnd();
  };

  // Handle drag over empty area of tab bar (for zone-based splitting)
  const handleBarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't show zone indicators if over a tab
    if (dragOverTabId) return;

    if (!tabBarRef.current) return;

    const rect = tabBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    const edgeThreshold = 60;

    if (x < edgeThreshold) {
      setDragOverZone("left");
    } else if (x > width - edgeThreshold) {
      setDragOverZone("right");
    } else if (y < height * 0.3) {
      setDragOverZone("top");
    } else if (y > height * 0.7) {
      setDragOverZone("bottom");
    } else {
      setDragOverZone("center");
    }
  };

  const handleBarDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if leaving the tab bar entirely
    if (!tabBarRef.current?.contains(e.relatedTarget as Node)) {
      setDragOverZone(null);
      setDragOverTabId(null);
      setDragOverPosition(null);
    }
  };

  const handleBarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData("application/json");
    if (!data) {
      handleTabDragEnd();
      return;
    }

    try {
      const { tabId, fromPaneId } = JSON.parse(data);
      if (dragOverZone && tabId) {
        moveTabToPane(connectionId, fromPaneId, tabId, paneId, dragOverZone);
      }
    } catch {
      // Invalid data
    }

    handleTabDragEnd();
  };

  return (
    <div
      ref={tabBarRef}
      className={cn(
        "relative flex h-9 items-center border-b border-border bg-background",
        !isActivePane && "opacity-80",
      )}
      onDragOver={handleBarDragOver}
      onDragLeave={handleBarDragLeave}
      onDrop={handleBarDrop}
    >
      {/* Drop zone indicators with smooth transitions */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-r-0 z-20 pointer-events-none transition-opacity duration-150",
          dragOverZone === "left" && !dragOverTabId ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-l-0 z-20 pointer-events-none transition-opacity duration-150",
          dragOverZone === "right" && !dragOverTabId ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute left-0 right-0 top-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-b-0 z-20 pointer-events-none transition-opacity duration-150",
          dragOverZone === "top" && !dragOverTabId ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-t-0 z-20 pointer-events-none transition-opacity duration-150",
          dragOverZone === "bottom" && !dragOverTabId ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "absolute inset-0 bg-primary/10 border-2 border-primary/50 z-20 pointer-events-none transition-opacity duration-150",
          dragOverZone === "center" && !dragOverTabId ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Tab list with horizontal scroll */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 items-center overflow-x-auto scrollbar-none"
      >
        <div className="flex">
          <AnimatePresence mode="popLayout" initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, width: 0 }}
                animate={{
                  opacity: 1,
                  width: "auto",
                }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="relative"
              >
                {/* Drop indicator before */}
                <div
                  className={cn(
                    "absolute left-0 top-1 bottom-1 w-0.5 bg-primary z-30 transition-opacity duration-100",
                    dragOverTabId === tab.id && dragOverPosition === "before"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />

                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      data-tab-draggable
                      draggable
                      onDragStart={(e) => handleTabDragStart(e, tab)}
                      onDragEnd={handleTabDragEnd}
                      onDragOver={(e) => handleTabDragOver(e, tab)}
                      onDrop={(e) => handleTabDrop(e, tab)}
                      onClick={() => handleTabClick(tab.id)}
                      onDoubleClick={() => handleDoubleClick(tab)}
                      className={cn(
                        "group relative flex h-9 min-w-25 max-w-50 items-center gap-2 border-r border-border px-3 text-sm transition-colors select-none cursor-pointer",
                        activeTabId === tab.id
                          ? "bg-secondary text-foreground"
                          : "bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                        draggingTabId === tab.id && "opacity-50",
                      )}
                    >
                      {/* Active indicator */}
                      {activeTabId === tab.id && !draggingTabId && (
                        <motion.div
                          layoutId={`activeTab-${paneId}`}
                          className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                          transition={{ duration: 0.15 }}
                        />
                      )}

                      {/* Drag handle */}
                      <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing" />

                      {getTabIcon(tab.type)}

                      {editingTabId === tab.id ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={handleTitleSave}
                          onKeyDown={handleTitleKeyDown}
                          className="w-full min-w-15 bg-transparent text-sm outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate">{tab.title}</span>
                      )}

                      {/* Close button */}
                      <button
                        onClick={(e) => handleCloseTab(e, tab.id)}
                        className={cn(
                          "ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100",
                          activeTabId === tab.id && "opacity-60",
                        )}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleDoubleClick(tab)}>
                      Rename Tab
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDuplicateTab(tab)}>
                      Duplicate Tab
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleSplitRight(tab.id)}>
                      Split Right
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleSplitDown(tab.id)}>
                      Split Down
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => closeTab(connectionId, paneId, tab.id)}>
                      Close Tab
                    </ContextMenuItem>
                    {tabs.length > 1 && (
                      <>
                        <ContextMenuItem onClick={() => handleCloseOtherTabs(tab.id)}>
                          Close Other Tabs
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleCloseTabsToRight(tab.id)}
                          disabled={tabs.findIndex((t) => t.id === tab.id) === tabs.length - 1}
                        >
                          Close Tabs to the Right
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>

                {/* Drop indicator after */}
                <div
                  className={cn(
                    "absolute right-0 top-1 bottom-1 w-0.5 bg-primary z-30 transition-opacity duration-100",
                    dragOverTabId === tab.id && dragOverPosition === "after"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* New tab dropdown */}
      <div className="flex items-center border-l border-border px-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {creatablePlugins.map((plugin: TabPlugin) => {
              const Icon = plugin.icon;
              // Custom display names for Redis
              let displayName = plugin.displayName;
              if (isRedis) {
                if (plugin.type === "data") displayName = "Keys";
                if (plugin.type === "query") displayName = "Console";
              }
              return (
                <DropdownMenuItem
                  key={plugin.type}
                  onClick={() => handleCreateTab(plugin.type as TabType)}
                >
                  <Icon className="h-4 w-4" />
                  New {displayName} Tab
                  {plugin.createShortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {plugin.createShortcut}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
