import { useState, useEffect } from "react";
import { Database, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface RedisDbSelectorProps {
  connectionId: string;
  currentDb?: number;
  onDbChange?: (db: number) => void;
}

interface DbInfo {
  index: number;
  keys: number;
  hasKeys: boolean;
}

export function RedisDbSelector({ connectionId, currentDb = 0, onDbChange }: RedisDbSelectorProps) {
  const [selectedDb, setSelectedDb] = useState(currentDb);
  const [dbInfo, setDbInfo] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDbInfo();
  }, [connectionId]);

  const fetchDbInfo = async () => {
    try {
      setLoading(true);
      const info = await api.executeQuery(connectionId, "INFO KEYSPACE");
      const infoText = (info.rows[0]?.[0] as string) || "";

      const newDbInfo = new Map<number, number>();

      // Parse keyspace info (e.g., "db0:keys=123,expires=10")
      const lines = infoText.split("\n");
      for (const line of lines) {
        const match = line.match(/db(\d+):keys=(\d+)/);
        if (match) {
          const dbIndex = parseInt(match[1], 10);
          const keyCount = parseInt(match[2], 10);
          newDbInfo.set(dbIndex, keyCount);
        }
      }

      setDbInfo(newDbInfo);
    } catch (error) {
      // Ignore errors - DB info is not critical
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDb = async (dbIndex: number) => {
    try {
      await api.executeQuery(connectionId, `SELECT ${dbIndex}`);
      setSelectedDb(dbIndex);
      onDbChange?.(dbIndex);
      toast.success(`Switched to database ${dbIndex}`);
    } catch (error) {
      toast.error(`Failed to switch database: ${error}`);
    }
  };

  // Generate database options (0-15 for standard Redis)
  const databases: DbInfo[] = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    keys: dbInfo.get(i) || 0,
    hasKeys: (dbInfo.get(i) || 0) > 0,
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          <span>DB {selectedDb}</span>
          {dbInfo.get(selectedDb) ? (
            <span className="text-xs text-muted-foreground">({dbInfo.get(selectedDb)} keys)</span>
          ) : null}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {databases.map((db) => (
          <DropdownMenuItem
            key={db.index}
            onClick={() => handleSelectDb(db.index)}
            className="flex items-center justify-between"
          >
            <span className={selectedDb === db.index ? "font-semibold" : ""}>
              Database {db.index}
            </span>
            <span
              className={`text-xs ${
                db.hasKeys ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}
            >
              {db.keys} keys
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
