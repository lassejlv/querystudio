import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Clock, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface SlowLogEntry {
  id: number;
  timestamp: number;
  duration: number;
  command: string;
}

interface RedisSlowLogProps {
  connectionId: string;
}

export function RedisSlowLog({ connectionId }: RedisSlowLogProps) {
  const [entries, setEntries] = useState<SlowLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState("10");

  const fetchSlowLog = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.executeQuery(connectionId, `SLOWLOG GET ${count}`);

      const parsedEntries: SlowLogEntry[] = result.rows.map((row) => ({
        id: row[0] as number,
        timestamp: row[1] as number,
        duration: row[2] as number,
        command: row[3] as string,
      }));

      setEntries(parsedEntries);
    } catch (error) {
      toast.error(`Failed to fetch slow log: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, count]);

  useEffect(() => {
    fetchSlowLog();
  }, [fetchSlowLog]);

  const handleReset = async () => {
    try {
      await api.executeQuery(connectionId, "SLOWLOG RESET");
      toast.success("Slow log reset");
      fetchSlowLog();
    } catch (error) {
      toast.error(`Failed to reset slow log: ${error}`);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (microseconds: number) => {
    if (microseconds < 1000) return `${microseconds} μs`;
    if (microseconds < 1000000) return `${(microseconds / 1000).toFixed(2)} ms`;
    return `${(microseconds / 1000000).toFixed(2)} s`;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Slow Log</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Count:</Label>
            <Input
              type="number"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-20 h-8"
              min="1"
              max="1000"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchSlowLog} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No slow log entries found</div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{entry.id}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono ${
                        entry.duration > 100000
                          ? "text-red-500"
                          : entry.duration > 10000
                            ? "text-yellow-500"
                            : "text-green-500"
                      }`}
                    >
                      {formatDuration(entry.duration)}
                    </span>
                  </div>
                  <div className="font-mono text-sm bg-muted/50 p-2 rounded overflow-x-auto">
                    <Terminal className="h-3 w-3 inline mr-2 text-muted-foreground" />
                    {entry.command}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
