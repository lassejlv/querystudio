import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useConnectionStore } from "@/lib/store";
import { useConnect, useSavedConnections } from "@/lib/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// This route redirects to the new multi-connection /db route
// and ensures the specified connection is added to active connections
export const Route = createFileRoute("/db/$connectionId")({
  component: LegacyConnectionRedirect,
});

function LegacyConnectionRedirect() {
  const navigate = useNavigate();
  const { connectionId } = useParams({ from: "/db/$connectionId" });
  
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const addConnection = useConnectionStore((s) => s.addConnection);
  const setActiveConnection = useConnectionStore((s) => s.setActiveConnection);
  
  const { data: savedConnections, isLoading } = useSavedConnections();
  const connect = useConnect();

  useEffect(() => {
    if (isLoading) return;

    // Check if already connected
    const existingConnection = activeConnections.find((c) => c.id === connectionId);
    if (existingConnection) {
      setActiveConnection(connectionId);
      navigate({ to: "/db", replace: true });
      return;
    }

    // Find saved connection
    const savedConnection = savedConnections?.find((c) => c.id === connectionId);
    if (!savedConnection) {
      toast.error("Connection not found");
      navigate({ to: "/", replace: true });
      return;
    }

    // Connect to it
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

    connect.mutate(
      {
        id: savedConnection.id,
        name: savedConnection.name,
        db_type: savedConnection.db_type || "postgres",
        config,
      },
      {
        onSuccess: () => {
          navigate({ to: "/db", replace: true });
        },
        onError: (error) => {
          toast.error(`Failed to connect: ${error}`);
          navigate({ to: "/", replace: true });
        },
      }
    );
  }, [connectionId, activeConnections, savedConnections, isLoading, connect, addConnection, setActiveConnection, navigate]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div
        data-tauri-drag-region
        className="h-8 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    </div>
  );
}
