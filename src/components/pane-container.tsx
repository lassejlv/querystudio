import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  memo,
  useMemo,
} from "react";
import {
  useLayoutStore,
  type Pane,
  type SplitPane,
  type LeafPane,
  type DropZone,
} from "@/lib/layout-store";
import { useShallow } from "zustand/react/shallow";

// Context to track global drag state
interface DragContextType {
  isDraggingTab: boolean;
  setIsDraggingTab: (dragging: boolean) => void;
}

const DragContext = createContext<DragContextType>({
  isDraggingTab: false,
  setIsDraggingTab: () => {},
});

export const useDragContext = () => useContext(DragContext);
import { TabBar } from "@/components/tab-bar";
import { TableViewer } from "@/components/table-viewer";
import { QueryEditor } from "@/components/query-editor";
import { cn } from "@/lib/utils";

interface PaneContainerProps {
  connectionId: string;
  dbType?: string;
}

export const PaneContainer = memo(function PaneContainer({
  connectionId,
  dbType,
}: PaneContainerProps) {
  // Use shallow comparison to minimize re-renders
  const { rootPaneId, allPanes } = useLayoutStore(
    useShallow((s) => ({
      rootPaneId: s.rootPaneId[connectionId],
      allPanes: s.panes[connectionId] || {},
    })),
  );
  const initializeLayout = useLayoutStore((s) => s.initializeLayout);
  const [isDraggingTab, setIsDraggingTab] = useState(false);

  // Listen for drag events globally
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      // Check if this is a tab drag by looking at the target
      const target = e.target as HTMLElement;
      if (target?.closest?.("[data-tab-draggable]")) {
        setIsDraggingTab(true);
      }
    };

    const handleDragEnd = () => {
      setIsDraggingTab(false);
    };

    // Use capture phase to catch the event early
    window.addEventListener("dragstart", handleDragStart, true);
    window.addEventListener("dragend", handleDragEnd, true);
    window.addEventListener("drop", handleDragEnd, true);

    return () => {
      window.removeEventListener("dragstart", handleDragStart, true);
      window.removeEventListener("dragend", handleDragEnd, true);
      window.removeEventListener("drop", handleDragEnd, true);
    };
  }, []);

  // Initialize layout if needed
  useEffect(() => {
    initializeLayout(connectionId, dbType);
  }, [connectionId, dbType, initializeLayout]);

  const rootPane = allPanes[rootPaneId];

  if (!rootPane) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Loading...</p>
      </div>
    );
  }

  const contextValue = useMemo(
    () => ({ isDraggingTab, setIsDraggingTab }),
    [isDraggingTab],
  );

  return (
    <DragContext.Provider value={contextValue}>
      <PaneRenderer
        connectionId={connectionId}
        dbType={dbType}
        pane={rootPane}
        allPanes={allPanes}
      />
    </DragContext.Provider>
  );
});

interface PaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: Pane;
  allPanes: Record<string, Pane>;
}

const PaneRenderer = memo(function PaneRenderer({
  connectionId,
  dbType,
  pane,
  allPanes,
}: PaneRendererProps) {
  if (pane.type === "leaf") {
    return (
      <LeafPaneRenderer
        connectionId={connectionId}
        dbType={dbType}
        pane={pane}
      />
    );
  }

  return (
    <SplitPaneRenderer
      connectionId={connectionId}
      dbType={dbType}
      pane={pane}
      allPanes={allPanes}
    />
  );
});

interface LeafPaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: LeafPane;
}

const LeafPaneRenderer = memo(function LeafPaneRenderer({
  connectionId,
  dbType,
  pane,
}: LeafPaneRendererProps) {
  const activePaneId = useLayoutStore((s) => s.activePaneId[connectionId]);
  const setActivePane = useLayoutStore((s) => s.setActivePane);
  const moveTabToPane = useLayoutStore((s) => s.moveTabToPane);
  const isActive = activePaneId === pane.id;
  const { isDraggingTab } = useDragContext();

  const [dragOverZone, setDragOverZone] = useState<DropZone | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);

  const handleFocus = useCallback(() => {
    if (!isActive) {
      setActivePane(connectionId, pane.id);
    }
  }, [isActive, setActivePane, connectionId, pane.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!contentRef.current) return;

    const rect = contentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Determine which zone based on position (edge threshold as percentage)
    const edgeThresholdX = width * 0.25;
    const edgeThresholdY = height * 0.25;

    if (x < edgeThresholdX) {
      setDragOverZone("left");
    } else if (x > width - edgeThresholdX) {
      setDragOverZone("right");
    } else if (y < edgeThresholdY) {
      setDragOverZone("top");
    } else if (y > height - edgeThresholdY) {
      setDragOverZone("bottom");
    } else {
      setDragOverZone("center");
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if leaving the content area entirely
    if (!contentRef.current?.contains(e.relatedTarget as Node)) {
      setDragOverZone(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
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
          moveTabToPane(connectionId, fromPaneId, tabId, pane.id, dragOverZone);
        }
      } catch {
        // Invalid data
      }

      setDragOverZone(null);
    },
    [dragOverZone, moveTabToPane, connectionId, pane.id],
  );

  const tabContent = useMemo(() => {
    if (!activeTab) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg">No tab selected</p>
            <p className="text-sm">Create a new tab using the + button above</p>
          </div>
        </div>
      );
    }

    if (activeTab.type === "data") {
      return (
        <TableViewer
          key={activeTab.id}
          tabId={activeTab.id}
          tableInfo={activeTab.tableInfo}
        />
      );
    }

    if (activeTab.type === "query") {
      return (
        <QueryEditor key={activeTab.id} tabId={activeTab.id} paneId={pane.id} />
      );
    }

    return null;
  }, [activeTab, pane.id]);

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        isActive && "ring-1 ring-primary/30 ring-inset",
      )}
      onClick={handleFocus}
    >
      <TabBar connectionId={connectionId} dbType={dbType} paneId={pane.id} />
      <div
        ref={contentRef}
        className="relative flex-1 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tabContent}

        {/* Transparent overlay to capture drag events when dragging a tab */}
        {isDraggingTab && (
          <div
            className="absolute inset-0 z-40"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}

        {/* Drop zone indicators */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-r-0 z-50 pointer-events-none flex items-center justify-center transition-opacity duration-150",
            dragOverZone === "left"
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          <div className="bg-primary/30 rounded px-3 py-1 text-sm font-medium text-primary-foreground">
            Split Left
          </div>
        </div>
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1/2 bg-primary/20 border-2 border-primary/50 border-l-0 z-50 pointer-events-none flex items-center justify-center transition-opacity duration-150",
            dragOverZone === "right"
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          <div className="bg-primary/30 rounded px-3 py-1 text-sm font-medium text-primary-foreground">
            Split Right
          </div>
        </div>
        <div
          className={cn(
            "absolute left-0 right-0 top-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-b-0 z-50 pointer-events-none flex items-center justify-center transition-opacity duration-150",
            dragOverZone === "top"
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          <div className="bg-primary/30 rounded px-3 py-1 text-sm font-medium text-primary-foreground">
            Split Up
          </div>
        </div>
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 h-1/2 bg-primary/20 border-2 border-primary/50 border-t-0 z-50 pointer-events-none flex items-center justify-center transition-opacity duration-150",
            dragOverZone === "bottom"
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          <div className="bg-primary/30 rounded px-3 py-1 text-sm font-medium text-primary-foreground">
            Split Down
          </div>
        </div>
        <div
          className={cn(
            "absolute inset-0 bg-primary/10 border-2 border-primary/50 z-50 pointer-events-none flex items-center justify-center transition-opacity duration-150",
            dragOverZone === "center"
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          <div className="bg-primary/30 rounded px-3 py-1 text-sm font-medium text-primary-foreground">
            Move Here
          </div>
        </div>
      </div>
    </div>
  );
});

interface SplitPaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: SplitPane;
  allPanes: Record<string, Pane>;
}

const SplitPaneRenderer = memo(function SplitPaneRenderer({
  connectionId,
  dbType,
  pane,
  allPanes,
}: SplitPaneRendererProps) {
  const resizePane = useLayoutStore((s) => s.resizePane);
  const [isResizing, setIsResizing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const firstPane = allPanes[pane.first];
  const secondPane = allPanes[pane.second];

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTransitioning(false);
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (pane.direction === "horizontal") {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }

      resizePane(connectionId, pane.id, newRatio);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Re-enable transitions after a brief delay
      setTimeout(() => setIsTransitioning(true), 50);
    };

    document.body.style.cursor =
      pane.direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, connectionId, pane.id, pane.direction, resizePane]);

  if (!firstPane || !secondPane) {
    return null;
  }

  const isHorizontal = pane.direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full",
        isHorizontal ? "flex-row" : "flex-col",
      )}
    >
      {/* First pane */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]:
            `calc(${pane.ratio * 100}% - 2px)`,
        }}
        className={cn(
          "overflow-hidden",
          isTransitioning &&
            !isResizing &&
            "transition-all duration-200 ease-out",
        )}
      >
        <PaneRenderer
          connectionId={connectionId}
          dbType={dbType}
          pane={firstPane}
          allPanes={allPanes}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          "shrink-0 bg-border transition-colors hover:bg-primary/50 active:bg-primary/70",
          isHorizontal
            ? "w-1 cursor-col-resize hover:w-1"
            : "h-1 cursor-row-resize hover:h-1",
          isResizing && "bg-primary/70",
        )}
      />

      {/* Second pane */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]:
            `calc(${(1 - pane.ratio) * 100}% - 2px)`,
        }}
        className={cn(
          "overflow-hidden",
          isTransitioning &&
            !isResizing &&
            "transition-all duration-200 ease-out",
        )}
      >
        <PaneRenderer
          connectionId={connectionId}
          dbType={dbType}
          pane={secondPane}
          allPanes={allPanes}
        />
      </div>
    </div>
  );
});
