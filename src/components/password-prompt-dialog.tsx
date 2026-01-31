import { useState, useEffect, useRef } from "react";
import { Loader2, Key, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnect, useCanConnect } from "@/lib/hooks";
import { toast } from "sonner";
import type { SavedConnection } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";

interface PasswordPromptDialogProps {
  connection: SavedConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasswordPromptDialog({
  connection,
  open,
  onOpenChange,
}: PasswordPromptDialogProps) {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const connect = useConnect();
  const connectingRef = useRef(false);
  const { canConnect, maxConnections } = useCanConnect();

  // Auto-connect for connection strings or SQLite (password optional)
  useEffect(() => {
    if (!connection || !open) return;
    const isConnectionString = "connection_string" in connection.config;
    const isSqlite = connection.db_type === "sqlite";
    if (!isConnectionString && !isSqlite) return;
    if (connectingRef.current) return;
    if (!canConnect) {
      toast.error(`Connection limit reached. Free tier allows ${maxConnections} connections.`);
      onOpenChange(false);
      return;
    }

    connectingRef.current = true;

    const config =
      "connection_string" in connection.config
        ? {
            db_type: connection.db_type || "postgres",
            connection_string: connection.config.connection_string,
          }
        : {
            db_type: connection.db_type || "postgres",
            ...connection.config,
            password: "",
          };

    connect
      .mutateAsync({
        id: connection.id,
        name: connection.name,
        db_type: connection.db_type || "postgres",
        config,
      })
      .then(() => {
        toast.success("Connected successfully");
        onOpenChange(false);
      })
      .catch((error) => {
        toast.error(`Connection failed: ${error}`);
        onOpenChange(false);
      })
      .finally(() => {
        connectingRef.current = false;
      });
  }, [connection, open, canConnect, maxConnections]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connection) return;
    if ("connection_string" in connection.config) return;

    if (!canConnect) {
      toast.error(`Connection limit reached. Free tier allows ${maxConnections} connections.`);
      return;
    }

    const config = {
      db_type: connection.db_type || "postgres",
      ...connection.config,
      password,
    };

    try {
      const tId = toast.loading("Connecting to database...");
      await connect.mutateAsync({
        id: connection.id,
        name: connection.name,
        db_type: connection.db_type || "postgres",
        config,
      });
      toast.success("Connected successfully", { id: tId });
      onOpenChange(false);
      setPassword("");
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
    }
    onOpenChange(newOpen);
  };

  // Don't show dialog for connection strings or SQLite (auto-connect via useEffect)
  const isConnectionString = connection && "connection_string" in connection.config;
  const isSqlite = connection?.db_type === "sqlite";
  if (isConnectionString || isSqlite) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Enter Password
          </DialogTitle>
          <DialogDescription>
            {connection?.name && (
              <>
                Connecting to <span className="font-medium text-foreground">{connection.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Connection Limit Warning */}
        {!canConnect && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-500">Connection limit reached</p>
              <p className="text-xs text-muted-foreground">
                Free tier allows {maxConnections} simultaneous connections. Disconnect an existing
                connection or upgrade to Pro.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate({ to: "/settings" });
                }}
                className="gap-1.5"
              >
                Go to Account Settings
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={!canConnect}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={connect.isPending || !canConnect}>
              {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
