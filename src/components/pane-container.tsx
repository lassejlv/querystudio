import { useState, useRef, useEffect, useCallback } from "react";
import { useLayoutStore, type Pane, type SplitPane, type LeafPane } from "@/lib/layout-store";
import { TabBar } from "@/components/tab-bar";
import { TableViewer } from "@/components/table-viewer";
import { QueryEditor } from "@/components/query-editor";
import { cn } from "@/lib/utils";

interface PaneContainerProps {
  connectionId: string;
  dbType?: string;
}

export function PaneContainer({ connectionId, dbType }: PaneContainerProps) {
  const rootPaneId = useLayoutStore((s) => s.rootPaneId[connectionId]);
  const allPanes = useLayoutStore((s) => s.panes[connectionId]) || {};
  const initializeLayout = useLayoutStore((s) => s.initializeLayout);

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

  return (
    <PaneRenderer
      connectionId={connectionId}
      dbType={dbType}
      pane={rootPane}
      allPanes={allPanes}
    />
  );
}

interface PaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: Pane;
  allPanes: Record<string, Pane>;
}

function PaneRenderer({ connectionId, dbType, pane, allPanes }: PaneRendererProps) {
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
}

interface LeafPaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: LeafPane;
}

function LeafPaneRenderer({ connectionId, dbType, pane }: LeafPaneRendererProps) {
  const activePaneId = useLayoutStore((s) => s.activePaneId[connectionId]);
  const setActivePane = useLayoutStore((s) => s.setActivePane);
  const isActive = activePaneId === pane.id;

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId);

  const handleFocus = () => {
    if (!isActive) {
      setActivePane(connectionId, pane.id);
    }
  };

  const renderTabContent = () => {
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
        <QueryEditor
          key={activeTab.id}
          tabId={activeTab.id}
          paneId={pane.id}
        />
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden",
        isActive && "ring-1 ring-primary/30 ring-inset"
      )}
      onClick={handleFocus}
    >
      <TabBar
        connectionId={connectionId}
        dbType={dbType}
        paneId={pane.id}
      />
      <div className="flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}

interface SplitPaneRendererProps {
  connectionId: string;
  dbType?: string;
  pane: SplitPane;
  allPanes: Record<string, Pane>;
}

function SplitPaneRenderer({ connectionId, dbType, pane, allPanes }: SplitPaneRendererProps) {
  const resizePane = useLayoutStore((s) => s.resizePane);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const firstPane = allPanes[pane.first];
  const secondPane = allPanes[pane.second];

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    };

    document.body.style.cursor = pane.direction === "horizontal" ? "col-resize" : "row-resize";
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
        isHorizontal ? "flex-row" : "flex-col"
      )}
    >
      {/* First pane */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]: `calc(${pane.ratio * 100}% - 2px)`,
        }}
        className="overflow-hidden"
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
          isResizing && "bg-primary/70"
        )}
      />

      {/* Second pane */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]: `calc(${(1 - pane.ratio) * 100}% - 2px)`,
        }}
        className="overflow-hidden"
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
}
