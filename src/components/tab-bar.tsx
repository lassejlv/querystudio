import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, Plus, Table2, Terminal, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  useLayoutStore,
  type Tab,
  type TabType,
  type DropZone,
} from "@/lib/layout-store";

interface TabBarProps {
  connectionId: string;
  dbType?: string;
  paneId: string;
}

export function TabBar({ connectionId, dbType, paneId }: TabBarProps) {
  const isRedis = dbType === "redis";

  // Subscribe to the panes state so we get updates
  const allPanes = useLayoutStore((s) => s.panes[connectionId]) || {};
  const activePaneId = useLayoutStore((s) => s.activePaneId[connectionId]);

  const pane = allPanes[paneId];
  const tabs = pane?.type === "leaf" ? pane.tabs : [];
  const activeTabId = pane?.type === "leaf" ? pane.activeTabId : null;
  const isActivePane = activePaneId === paneId;

  // Get actions from the store
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const createTab = useLayoutStore((s) => s.createTab);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const updateTab = useLayoutStore((s) => s.updateTab);
  const reorderTabs = useLayoutStore((s) => s.reorderTabs);
  const splitPane = useLayoutStore((s) => s.splitPane);
  const moveTabToPane = useLayoutStore((s) => s.moveTabToPane);
  const getAllLeafPanes = useLayoutStore((s) => s.getAllLeafPanes);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
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

  const handleTabClick = (tabId: string) => {
    if (editingTabId !== tabId) {
      setActiveTab(connectionId, paneId, tabId);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(connectionId, paneId, tabId);
  };

  const handleDoubleClick = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleTitleSave = () => {
    if (editingTabId && editingTitle.trim()) {
      updateTab(connectionId, paneId, editingTabId, {
        title: editingTitle.trim(),
      });
    }
    setEditingTabId(null);
    setEditingTitle("");
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditingTabId(null);
      setEditingTitle("");
    }
  };

  const handleCreateTab = (type: TabType) => {
    const title =
      type === "query"
        ? isRedis
          ? "Console"
          : "Query"
        : isRedis
          ? "Keys"
          : "Data";
    createTab(connectionId, paneId, type, { title });
  };

  const handleCloseOtherTabs = (tabId: string) => {
    const tabsToClose = tabs.filter((t) => t.id !== tabId);
    tabsToClose.forEach((t) => closeTab(connectionId, paneId, t.id));
  };

  const handleCloseTabsToRight = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const tabsToClose = tabs.slice(tabIndex + 1);
    tabsToClose.forEach((t) => closeTab(connectionId, paneId, t.id));
  };

  const handleDuplicateTab = (tab: Tab) => {
    createTab(connectionId, paneId, tab.type, {
      title: `${tab.title} (copy)`,
      tableInfo: tab.tableInfo,
      queryContent: tab.queryContent,
    });
  };

  const handleSplitRight = (tabId: string) => {
    splitPane(connectionId, paneId, "horizontal", tabId);
  };

  const handleSplitDown = (tabId: string) => {
    splitPane(connectionId, paneId, "vertical", tabId);
  };

  const getTabIcon = (type: TabType) => {
    if (type === "query") {
      return <Terminal className="h-3.5 w-3.5 shrink-0" />;
    }
    return <Table2 className="h-3.5 w-3.5 shrink-0" />;
  };

  // Handle reorder from framer-motion
  const handleReorder = (newOrder: Tab[]) => {
    const newIds = newOrder.map((t) => t.id);
    const oldIds = tabs.map((t) => t.id);

    for (let i = 0; i < newIds.length; i++) {
      if (newIds[i] !== oldIds[i]) {
        const movedTabId = newIds[i];
        const fromIndex = oldIds.indexOf(movedTabId);
        const toIndex = i;
        if (fromIndex !== -1 && fromIndex !== toIndex) {
          reorderTabs(connectionId, paneId, fromIndex, toIndex);
        }
        break;
      }
    }
  };

  // Handle drag and drop for splitting
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tabBarRef.current) return;

    const rect = tabBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Determine which zone based on position
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

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData("application/json");
    if (!data) {
      setDragOverZone(null);
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

    setDragOverZone(null);
  };

  const handleTabDragStart = (e: React.DragEvent, tab: Tab) => {
    setDraggingTabId(tab.id);
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ tabId: tab.id, fromPaneId: paneId }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTabDragEnd = () => {
    setDraggingTabId(null);
    setDragOverZone(null);
  };

  // Count other panes for context menu
  const leafPanes = getAllLeafPanes(connectionId);
  const hasMultiplePanes = leafPanes.length > 1;

  return (
    <div
      ref={tabBarRef}
      className={cn(
        "relative flex h-9 items-center border-b border-border bg-background",
        !isActivePane && "opacity-80",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone indicators */}
      {dragOverZone && (
        <>
          {dragOverZone === "left" && (
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-r-0 z-20 pointer-events-none" />
          )}
          {dragOverZone === "right" && (
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-l-0 z-20 pointer-events-none" />
          )}
          {dragOverZone === "top" && (
            <div className="absolute left-0 right-0 top-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-b-0 z-20 pointer-events-none" />
          )}
          {dragOverZone === "bottom" && (
            <div className="absolute left-0 right-0 bottom-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-t-0 z-20 pointer-events-none" />
          )}
          {dragOverZone === "center" && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-primary/50 z-20 pointer-events-none" />
          )}
        </>
      )}

      {/* Tab list with horizontal scroll and drag-drop */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 items-center overflow-x-auto scrollbar-none"
      >
        <Reorder.Group
          axis="x"
          values={tabs}
          onReorder={handleReorder}
          className="flex"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {tabs.map((tab) => (
              <Reorder.Item
                key={tab.id}
                value={tab}
                id={tab.id}
                onDragStart={() => setDraggingTabId(tab.id)}
                onDragEnd={() => setDraggingTabId(null)}
                initial={{ opacity: 0, width: 0 }}
                animate={{
                  opacity: 1,
                  width: "auto",
                  scale: draggingTabId === tab.id ? 1.02 : 1,
                  zIndex: draggingTabId === tab.id ? 10 : 0,
                }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                whileDrag={{
                  scale: 1.02,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  cursor: "grabbing",
                }}
                className={cn("relative", draggingTabId === tab.id && "z-10")}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      draggable
                      onDragStart={(e) => handleTabDragStart(e, tab)}
                      onDragEnd={handleTabDragEnd}
                      onClick={() => handleTabClick(tab.id)}
                      onDoubleClick={() => handleDoubleClick(tab)}
                      className={cn(
                        "group relative flex h-9 min-w-[100px] max-w-[200px] items-center gap-2 border-r border-border px-3 text-sm transition-colors select-none cursor-pointer",
                        activeTabId === tab.id
                          ? "bg-secondary text-foreground"
                          : "bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                        draggingTabId === tab.id && "bg-secondary/80 shadow-lg",
                        draggingTabId &&
                          draggingTabId !== tab.id &&
                          "opacity-70",
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
                          className="w-full min-w-[60px] bg-transparent text-sm outline-none"
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
                    <ContextMenuItem
                      onClick={() => closeTab(connectionId, paneId, tab.id)}
                    >
                      Close Tab
                    </ContextMenuItem>
                    {tabs.length > 1 && (
                      <>
                        <ContextMenuItem
                          onClick={() => handleCloseOtherTabs(tab.id)}
                        >
                          Close Other Tabs
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => handleCloseTabsToRight(tab.id)}
                          disabled={
                            tabs.findIndex((t) => t.id === tab.id) ===
                            tabs.length - 1
                          }
                        >
                          Close Tabs to the Right
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
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
            <DropdownMenuItem onClick={() => handleCreateTab("data")}>
              <Table2 className="h-4 w-4" />
              New {isRedis ? "Keys" : "Data"} Tab
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreateTab("query")}>
              <Terminal className="h-4 w-4" />
              New {isRedis ? "Console" : "Query"} Tab
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
