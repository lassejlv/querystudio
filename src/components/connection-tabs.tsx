import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/lib/store";
import { useDisconnect, useSavedConnections, useConnect } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Plus, X, Database } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

interface ConnectionTabsProps {
  onAddConnection?: () => void;
}

export function ConnectionTabs({ onAddConnection }: ConnectionTabsProps) {
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const setActiveConnection = useConnectionStore((s) => s.setActiveConnection);
  const removeConnection = useConnectionStore((s) => s.removeConnection);

  const disconnect = useDisconnect();
  const { data: savedConnections } = useSavedConnections();
  const connect = useConnect();
  const isReconnecting = useRef(false);

  const handleCloseConnection = async (connectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    console.log("[FRONTEND] Closing connection:", connectionId);
    
    try {
      // Disconnect from backend
      await disconnect.mutateAsync(connectionId);
      console.log("[FRONTEND] Backend disconnect successful");
    } catch (err) {
      console.error("[FRONTEND] Backend disconnect failed:", err);
    }
    
    // Remove from store
    removeConnection(connectionId);
    console.log("[FRONTEND] Removed from store");
  };

  const handleAddConnection = () => {
    onAddConnection?.();
  };

  const handleTabClick = async (connectionId: string) => {
    // Check if this is already the active connection
    if (connectionId === activeConnectionId) return;

    // Prevent multiple simultaneous reconnects
    if (isReconnecting.current) return;

    // Find the connection in active connections
    const connection = activeConnections.find((c) => c.id === connectionId);
    if (!connection) return;

    // First, set it as active
    setActiveConnection(connectionId);

    // For Redis connections, verify the connection is still alive by calling list_tables
    if (connection.db_type === "redis") {
      try {
        const { api } = await import("@/lib/api");
        await api.listTables(connectionId);
      } catch (_error) {
        // Connection lost, need to reconnect
        const savedConnection = savedConnections?.find((c) => c.id === connectionId);
        if (!savedConnection) {
          toast.error("Connection configuration not found");
          return;
        }

        isReconnecting.current = true;

        // Reconnect
        const config =
          "connection_string" in savedConnection.config
            ? {
                db_type: savedConnection.db_type || "postgres",
                connection_string: savedConnection.config.connection_string,
              }
            : {
                db_type: savedConnection.db_type || "postgres",
                ...savedConnection.config,
                password: "",
              };

        try {
          await connect.mutateAsync({
            id: savedConnection.id,
            name: savedConnection.name,
            db_type: savedConnection.db_type || "postgres",
            config,
            save: false, // Don't save again, just reconnect
          });
          toast.success("Reconnected to Redis");
        } catch (error) {
          toast.error(`Failed to reconnect: ${error}`);
        } finally {
          isReconnecting.current = false;
        }
      }
    }
  };

  if (activeConnections.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide">
        {activeConnections.map((connection) => {
          const isActive = connection.id === activeConnectionId;
          
          return (
            <button
              key={connection.id}
              onClick={() => handleTabClick(connection.id)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] transition-colors",
                isActive
                  ? "bg-background text-foreground border-b-2 border-b-primary -mb-[1px]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1 text-left">{connection.name}</span>
              <span
                onClick={(e) => handleCloseConnection(connection.id, e)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted-foreground/20 transition-opacity",
                  isActive && "opacity-100"
                )}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        className="h-full px-3 text-muted-foreground hover:text-foreground shrink-0"
        onClick={handleAddConnection}
        title="Add connection"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
