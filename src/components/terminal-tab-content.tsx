import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal } from "./terminal";
import { useLayoutStore } from "@/lib/layout-store";
import type { TabContentProps } from "@/lib/tab-sdk";

interface TerminalTabContentProps extends TabContentProps {}

// Track terminal creation state per tabId to prevent double creation
const creatingTerminals = new Set<string>();
const createdTerminals = new Set<string>();

export function TerminalTabContent({
  tabId,
  paneId,
  connectionId,
}: TerminalTabContentProps) {
  const pane = useLayoutStore((s) => s.panes[connectionId]?.[paneId]);
  const updateTab = useLayoutStore((s) => s.updateTab);
  const closeTab = useLayoutStore((s) => s.closeTab);

  const tab =
    pane?.type === "leaf" ? pane.tabs.find((t) => t.id === tabId) : null;

  const terminalId = tab?.terminalId;
  const terminalIdRef = useRef<string | undefined>(terminalId);

  // Keep ref in sync for cleanup
  useEffect(() => {
    terminalIdRef.current = terminalId;
  }, [terminalId]);

  // Create terminal on mount if not already created
  useEffect(() => {
    if (!connectionId || !paneId || !tabId) return;

    // Already has a terminal ID
    if (terminalId) {
      createdTerminals.add(tabId);
      return;
    }

    // Already creating or created for this specific tabId
    if (creatingTerminals.has(tabId) || createdTerminals.has(tabId)) {
      return;
    }

    const createTerminal = async () => {
      creatingTerminals.add(tabId);
      try {
        const id = await invoke<string>("terminal_create", {
          rows: 24,
          cols: 80,
        });

        updateTab(connectionId, paneId, tabId, {
          terminalId: id,
          metadata: {
            terminalId: id,
            createdAt: new Date(),
          },
        });
        createdTerminals.add(tabId);
      } catch (error) {
        console.error("Failed to create terminal:", error);
      } finally {
        creatingTerminals.delete(tabId);
      }
    };

    createTerminal();
  }, [connectionId, paneId, tabId, terminalId, updateTab]);

  // Cleanup terminal on unmount
  useEffect(() => {
    return () => {
      // Clean up tracking sets
      creatingTerminals.delete(tabId);
      createdTerminals.delete(tabId);

      // Close the terminal backend process
      const currentTerminalId = terminalIdRef.current;
      if (currentTerminalId) {
        invoke("terminal_close", { id: currentTerminalId }).catch((error) => {
          console.error("Failed to close terminal:", error);
        });
      }
    };
  }, [tabId]);

  const handleClose = useCallback(() => {
    closeTab(connectionId, paneId, tabId);
  }, [closeTab, connectionId, paneId, tabId]);

  if (!terminalId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Creating terminal...</p>
      </div>
    );
  }

  return (
    <Terminal terminalId={terminalId} isVisible={true} onClose={handleClose} />
  );
}
