import { useState, useEffect, useRef } from "react";
import { Loader2, Key } from "lucide-react";
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
import { useConnect } from "@/lib/hooks";
import { toast } from "sonner";
import type { SavedConnection } from "@/lib/types";

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
  const connect = useConnect();
  const connectingRef = useRef(false);

  // Auto-connect for connection strings (no password needed)
  useEffect(() => {
    if (!connection || !open) return;
    if (!("connection_string" in connection.config)) return;
    if (connectingRef.current) return;

    connectingRef.current = true;
    
    const config = { connection_string: connection.config.connection_string };
    
    connect.mutateAsync({
      id: connection.id,
      name: connection.name,
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
  }, [connection, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connection) return;
    if ("connection_string" in connection.config) return;

    const config = {
      ...connection.config,
      password,
    };

    try {
      await connect.mutateAsync({
        id: connection.id,
        name: connection.name,
        config,
      });
      toast.success("Connected successfully");
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

  // Don't show dialog for connection strings (auto-connect via useEffect)
  const isConnectionString = connection && "connection_string" in connection.config;
  if (isConnectionString) {
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
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Connect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
