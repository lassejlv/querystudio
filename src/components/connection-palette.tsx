import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Database, Plus } from "lucide-react";
import { useSavedConnections, useConnect } from "@/lib/hooks";
import { useNavigate } from "@tanstack/react-router";
import type { SavedConnection } from "@/lib/types";
import { toast } from "sonner";

interface ConnectionPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConnection?: (connection: SavedConnection) => void;
}

export function ConnectionPalette({ open, onOpenChange, onSelectConnection }: ConnectionPaletteProps) {
  const navigate = useNavigate();
  const { data: savedConnections, isLoading } = useSavedConnections();
  const connect = useConnect();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const handleSelectConnection = async (savedConnection: SavedConnection) => {
    onOpenChange(false);

    if (onSelectConnection) {
      onSelectConnection(savedConnection);
      return;
    }

    if ("connection_string" in savedConnection.config) {
      try {
        await connect.mutateAsync({
          id: savedConnection.id,
          name: savedConnection.name,
          db_type: savedConnection.db_type || "postgres",
          config: {
            db_type: savedConnection.db_type || "postgres",
            connection_string: savedConnection.config.connection_string,
          },
          save: false,
        });
        toast.success(`Connected to ${savedConnection.name}`);
      } catch (error) {
        toast.error(`Failed to connect: ${error}`);
      }
    } else {
      navigate({
        to: "/db/$connectionId",
        params: { connectionId: savedConnection.id },
      });
    }
  };

  const handleNewConnection = () => {
    onOpenChange(false);
    navigate({ to: "/new-connection" });
  };

  const filteredConnections = savedConnections?.filter((conn) =>
    conn.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search connections or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No connections found.</CommandEmpty>

        <CommandGroup heading="Quick Connect">
          {isLoading ? (
            <CommandItem disabled>Loading saved connections...</CommandItem>
          ) : (
            filteredConnections?.map((connection) => (
              <CommandItem
                key={connection.id}
                onSelect={() => handleSelectConnection(connection)}
              >
                <Database className="mr-2 h-4 w-4" />
                <span>{connection.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {connection.db_type || "postgres"}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleNewConnection}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Connection</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
