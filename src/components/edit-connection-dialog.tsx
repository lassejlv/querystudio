import { useState, useEffect } from "react";
import { Loader2, Database, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveConnection, useTestConnection } from "@/lib/hooks";
import { toast } from "sonner";
import type {
  SavedConnection,
  ConnectionConfig,
  DatabaseType,
} from "@/lib/types";

interface EditConnectionDialogProps {
  connection: SavedConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DATABASE_CONFIGS: Record<
  DatabaseType,
  { port: string; database: string; username: string }
> = {
  postgres: { port: "5432", database: "postgres", username: "postgres" },
  mysql: { port: "3306", database: "mysql", username: "root" },
  sqlite: { port: "0", database: "", username: "" },
  redis: { port: "6379", database: "0", username: "" },
};

export function EditConnectionDialog({
  connection,
  open,
  onOpenChange,
}: EditConnectionDialogProps) {
  const [testing, setTesting] = useState(false);
  const [mode, setMode] = useState<"params" | "string" | "file">("params");
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [formData, setFormData] = useState({
    name: "",
    host: "localhost",
    port: "5432",
    database: "postgres",
    username: "postgres",
    password: "",
    connectionString: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveConnection = useSaveConnection();
  const testConnection = useTestConnection();

  // Populate form when connection changes
  useEffect(() => {
    if (connection) {
      setDbType(connection.db_type || "postgres");
      if ("connection_string" in connection.config) {
        // SQLite uses file mode, others use string mode
        setMode(connection.db_type === "sqlite" ? "file" : "string");
        const defaults = DATABASE_CONFIGS[connection.db_type || "postgres"];
        setFormData({
          name: connection.name,
          host: "localhost",
          port: defaults.port,
          database: defaults.database,
          username: defaults.username,
          password: "",
          connectionString: connection.config.connection_string,
        });
      } else {
        setMode("params");
        setFormData({
          name: connection.name,
          host: connection.config.host,
          port: String(connection.config.port),
          database: connection.config.database,
          username: connection.config.username,
          password: "",
          connectionString: "",
        });
      }
      setErrors({});
    }
  }, [connection]);

  const handleDbTypeChange = (newType: DatabaseType) => {
    setDbType(newType);
    const defaults = DATABASE_CONFIGS[newType];
    setFormData((prev) => ({
      ...prev,
      port: defaults.port,
      database: defaults.database,
      username: defaults.username,
    }));
    if (newType === "sqlite") {
      setMode("file");
    } else if (mode === "file") {
      setMode("params");
    }
  };

  const validateParams = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.host.trim()) newErrors.host = "Host is required";
    // Database is optional for Redis (defaults to 0)
    if (dbType !== "redis" && !formData.database.trim())
      newErrors.database = "Database is required";
    // Username is optional for Redis
    if (dbType !== "redis" && !formData.username.trim()) {
      newErrors.username = "Username is required";
    }
    const port = parseInt(formData.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      newErrors.port = "Invalid port";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateString = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.connectionString.trim()) {
      newErrors.connectionString = "Connection string is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateFile = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.connectionString.trim()) {
      newErrors.connectionString = "File path is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate = () => {
    if (mode === "params") return validateParams();
    if (mode === "file") return validateFile();
    return validateString();
  };

  const getSavedConfig = () => {
    if (mode === "string") {
      return { connection_string: formData.connectionString };
    }
    return {
      host: formData.host,
      port: parseInt(formData.port, 10),
      database: formData.database,
      username: formData.username,
    };
  };

  const getTestConfig = (): ConnectionConfig => {
    if (mode === "string") {
      return { db_type: dbType, connection_string: formData.connectionString };
    }
    return {
      db_type: dbType,
      host: formData.host,
      port: parseInt(formData.port, 10),
      database: formData.database,
      username: formData.username,
      password: formData.password,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !connection) return;

    const savedConfig = getSavedConfig();

    try {
      await saveConnection.mutateAsync({
        id: connection.id,
        name: formData.name,
        db_type: dbType,
        config: savedConfig,
      });
      toast.success("Connection updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to update connection: ${error}`);
    }
  };

  const handleTest = async () => {
    if (!validate()) return;

    const config = getTestConfig();

    setTesting(true);
    try {
      await testConnection.mutateAsync(config);
      toast.success("Connection successful");
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const getConnectionStringPlaceholder = () => {
    if (dbType === "mysql") {
      return "mysql://user:password@localhost:3306/database";
    }
    if (dbType === "sqlite") {
      return "C:\\path\\to\\database.db";
    }
    if (dbType === "redis") {
      return "redis://[:password@]localhost:6379[/database]";
    }
    return "postgresql://user:password@localhost:5432/database";
  };

  const getConnectionStringHelp = () => {
    if (dbType === "mysql") {
      return "Supports MySQL connection URI format";
    }
    if (dbType === "sqlite") {
      return "Full path to your SQLite database file";
    }
    if (dbType === "redis") {
      return "Redis connection URI format";
    }
    return "Supports PostgreSQL connection URI or key-value format";
  };

  const getDbTypeLabel = () => {
    if (dbType === "mysql") return "MySQL";
    if (dbType === "sqlite") return "SQLite";
    if (dbType === "redis") return "Redis";
    return "PostgreSQL";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Edit {getDbTypeLabel()} Connection
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Connection Name</Label>
            <Input
              id="edit-name"
              placeholder="My Database"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-dbType">Database Type</Label>
            <Select
              value={dbType}
              onValueChange={(v) => handleDbTypeChange(v as DatabaseType)}
            >
              <SelectTrigger id="edit-dbType">
                <SelectValue placeholder="Select database type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 font-semibold">P</span>
                    PostgreSQL
                  </div>
                </SelectItem>
                <SelectItem value="mysql">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-500 font-semibold">M</span>
                    MySQL
                  </div>
                </SelectItem>
                <SelectItem value="sqlite">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-500 font-semibold">S</span>
                    SQLite
                  </div>
                </SelectItem>
                <SelectItem value="redis">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-semibold">R</span>
                    Redis
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dbType === "sqlite" ? (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-connectionString">Database File</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-connectionString"
                    placeholder="Select a SQLite database file..."
                    value={formData.connectionString}
                    onChange={(e) =>
                      updateField("connectionString", e.target.value)
                    }
                    className="font-mono text-sm flex-1"
                  />
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3,.db3"
                    className="hidden"
                    id="edit-sqlite-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const path = (file as any).path || file.name;
                        updateField("connectionString", path);
                      }
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      document.getElementById("edit-sqlite-file-input")?.click()
                    }
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                {errors.connectionString && (
                  <p className="text-xs text-red-500">
                    {errors.connectionString}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Browse for a .db, .sqlite, or .sqlite3 file
                </p>
              </div>
            </div>
          ) : (
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "params" | "string")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="params">Parameters</TabsTrigger>
                <TabsTrigger value="string">Connection String</TabsTrigger>
              </TabsList>

              <TabsContent value="params" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="edit-host">Host</Label>
                    <Input
                      id="edit-host"
                      placeholder="localhost"
                      value={formData.host}
                      onChange={(e) => updateField("host", e.target.value)}
                    />
                    {errors.host && (
                      <p className="text-xs text-red-500">{errors.host}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-port">Port</Label>
                    <Input
                      id="edit-port"
                      type="number"
                      placeholder={DATABASE_CONFIGS[dbType].port}
                      value={formData.port}
                      onChange={(e) => updateField("port", e.target.value)}
                    />
                    {errors.port && (
                      <p className="text-xs text-red-500">{errors.port}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-database">Database</Label>
                  <Input
                    id="edit-database"
                    placeholder={DATABASE_CONFIGS[dbType].database}
                    value={formData.database}
                    onChange={(e) => updateField("database", e.target.value)}
                  />
                  {errors.database && (
                    <p className="text-xs text-red-500">{errors.database}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-username">Username</Label>
                    <Input
                      id="edit-username"
                      placeholder={DATABASE_CONFIGS[dbType].username}
                      value={formData.username}
                      onChange={(e) => updateField("username", e.target.value)}
                    />
                    {errors.username && (
                      <p className="text-xs text-red-500">{errors.username}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-password">Password</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for testing
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="string" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-connectionString">
                    Connection String
                  </Label>
                  <Textarea
                    id="edit-connectionString"
                    placeholder={getConnectionStringPlaceholder()}
                    value={formData.connectionString}
                    onChange={(e) =>
                      updateField("connectionString", e.target.value)
                    }
                    className="min-h-[80px] font-mono text-sm"
                  />
                  {errors.connectionString && (
                    <p className="text-xs text-red-500">
                      {errors.connectionString}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {getConnectionStringHelp()}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
            <Button type="submit" disabled={saveConnection.isPending}>
              {saveConnection.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
