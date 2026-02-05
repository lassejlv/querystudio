import { useState, useEffect, useCallback } from "react";
import { X, Clock, Database, Hash, FileType, Binary } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface KeyInspectorProps {
  connectionId: string;
  keyName: string;
  onClose: () => void;
}

interface KeyDetails {
  key: string;
  type: string;
  ttl: number;
  size: number;
  encoding: string;
  value: unknown;
}

export function RedisKeyInspector({ connectionId, keyName, onClose }: KeyInspectorProps) {
  const [details, setDetails] = useState<KeyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTtl, setNewTtl] = useState("");
  const [editedValue, setEditedValue] = useState("");

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      // Get key type
      const typeResult = await api.executeQuery(connectionId, `TYPE "${keyName}"`);
      const type = (typeResult.rows[0]?.[0] as string) || "none";

      // Get TTL
      const ttlResult = await api.executeQuery(connectionId, `TTL "${keyName}"`);
      const ttl = (ttlResult.rows[0]?.[0] as number) || -2;

      // Get memory usage
      const sizeResult = await api.executeQuery(connectionId, `MEMORY USAGE "${keyName}"`);
      const size = (sizeResult.rows[0]?.[0] as number) || 0;

      // Get encoding
      const encodingResult = await api.executeQuery(connectionId, `OBJECT ENCODING "${keyName}"`);
      const encoding = (encodingResult.rows[0]?.[0] as string) || "unknown";

      // Get value based on type
      let value: unknown = null;
      switch (type) {
        case "string":
          const strResult = await api.executeQuery(connectionId, `GET "${keyName}"`);
          value = strResult.rows[0]?.[0];
          break;
        case "hash":
          const hashResult = await api.executeQuery(connectionId, `HGETALL "${keyName}"`);
          value = hashResult.rows.reduce(
            (acc, row) => {
              acc[row[0] as string] = row[1];
              return acc;
            },
            {} as Record<string, unknown>,
          );
          break;
        case "list":
          const listResult = await api.executeQuery(connectionId, `LRANGE "${keyName}" 0 -1`);
          value = listResult.rows.map((row) => row[0]);
          break;
        case "set":
          const setResult = await api.executeQuery(connectionId, `SMEMBERS "${keyName}"`);
          value = setResult.rows.map((row) => row[0]);
          break;
        case "zset":
          const zsetResult = await api.executeQuery(
            connectionId,
            `ZRANGE "${keyName}" 0 -1 WITHSCORES`,
          );
          value = zsetResult.rows.map((row) => ({ member: row[0], score: row[1] }));
          break;
        default:
          value = null;
      }

      const detailsData = { key: keyName, type, ttl, size, encoding, value };
      setDetails(detailsData);
      setEditedValue(JSON.stringify(value, null, 2));
    } catch (error) {
      toast.error(`Failed to fetch key details: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, keyName]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleSetTtl = async () => {
    try {
      const ttl = parseInt(newTtl, 10);
      if (isNaN(ttl)) {
        toast.error("Invalid TTL value");
        return;
      }

      if (ttl === -1) {
        await api.executeQuery(connectionId, `PERSIST "${keyName}"`);
        toast.success("TTL removed (key will not expire)");
      } else {
        await api.executeQuery(connectionId, `EXPIRE "${keyName}" ${ttl}`);
        toast.success(`TTL set to ${ttl} seconds`);
      }
      fetchDetails();
      setNewTtl("");
    } catch (error) {
      toast.error(`Failed to set TTL: ${error}`);
    }
  };

  const handleDelete = async () => {
    try {
      await api.executeQuery(connectionId, `DEL "${keyName}"`);
      toast.success("Key deleted");
      onClose();
    } catch (error) {
      toast.error(`Failed to delete key: ${error}`);
    }
  };

  const handleRename = async () => {
    const newName = prompt("Enter new key name:", keyName);
    if (newName && newName !== keyName) {
      try {
        await api.executeQuery(connectionId, `RENAME "${keyName}" "${newName}"`);
        toast.success("Key renamed");
        onClose();
      } catch (error) {
        toast.error(`Failed to rename key: ${error}`);
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "string":
        return <FileType className="h-4 w-4" />;
      case "hash":
        return <Hash className="h-4 w-4" />;
      case "list":
        return <Database className="h-4 w-4" />;
      case "set":
        return <Binary className="h-4 w-4" />;
      case "zset":
        return <Clock className="h-4 w-4" />;
      default:
        return <FileType className="h-4 w-4" />;
    }
  };

  const formatTtl = (ttl: number) => {
    if (ttl === -1) return "No expiration";
    if (ttl === -2) return "Key does not exist";
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
    return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Failed to load key details
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          {getTypeIcon(details.type)}
          <span className="font-mono text-sm truncate" title={keyName}>
            {keyName}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {details.type}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Key Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">TTL</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={details.ttl === -1 ? "text-muted-foreground" : "text-yellow-600"}>
                  {formatTtl(details.ttl)}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <div className="text-sm font-medium">{formatSize(details.size)}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Encoding</Label>
              <div className="text-sm font-mono">{details.encoding}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <div className="text-sm">{details.type}</div>
            </div>
          </div>

          {/* TTL Management */}
          <div className="space-y-2">
            <Label>Set TTL</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Seconds (-1 to persist)"
                value={newTtl}
                onChange={(e) => setNewTtl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSetTtl} variant="secondary">
                Set
              </Button>
            </div>
          </div>

          {/* Value Preview */}
          <Tabs defaultValue="preview">
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">
                Preview
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1">
                JSON
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-2">
              <div className="border rounded-md p-3 bg-muted/50">
                {details.type === "string" && (
                  <div className="font-mono text-sm break-all">{String(details.value)}</div>
                )}
                {details.type === "hash" && (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(details.value as Record<string, unknown>).map(([k, v]) => (
                        <tr key={k} className="border-b last:border-0">
                          <td className="py-1 pr-4 font-mono text-muted-foreground">{k}</td>
                          <td className="py-1 font-mono break-all">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {details.type === "list" && (
                  <ol className="list-decimal list-inside space-y-1">
                    {(details.value as unknown[]).map((item, i) => (
                      <li key={i} className="font-mono text-sm">
                        {String(item)}
                      </li>
                    ))}
                  </ol>
                )}
                {details.type === "set" && (
                  <ul className="space-y-1">
                    {(details.value as unknown[]).map((item, i) => (
                      <li key={i} className="font-mono text-sm">
                        • {String(item)}
                      </li>
                    ))}
                  </ul>
                )}
                {details.type === "zset" && (
                  <table className="w-full text-sm">
                    <tbody>
                      {(details.value as { member: unknown; score: unknown }[]).map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-4 font-mono">{String(item.member)}</td>
                          <td className="py-1 font-mono text-muted-foreground">
                            {String(item.score)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
            <TabsContent value="json" className="mt-2">
              <pre className="border rounded-md p-3 bg-muted/50 text-xs font-mono overflow-auto max-h-64">
                {JSON.stringify(details.value, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleRename} className="flex-1">
              Rename
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
