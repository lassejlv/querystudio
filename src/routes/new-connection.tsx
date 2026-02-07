import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertTriangle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useConnect, useTestConnection, useCanSaveConnection } from "@/lib/hooks";
import { toast } from "sonner";
import type { ConnectionConfig, DatabaseType, SavedConnection } from "@/lib/types";
import { CommandPalette } from "@/components/command-palette";
import { PasswordPromptDialog } from "@/components/password-prompt-dialog";
import { useGlobalShortcuts } from "@/lib/use-global-shortcuts";
import { openSettingsWindow } from "@/lib/settings-window";

export const Route = createFileRoute("/new-connection")({
  component: NewConnectionPage,
});

interface DatabaseOption {
  id: DatabaseType;
  name: string;
  defaults: { port: string; database: string; username: string; host: string };
}

const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    defaults: {
      port: "5432",
      database: "postgres",
      username: "postgres",
      host: "localhost",
    },
  },
  {
    id: "mysql",
    name: "MySQL",
    defaults: {
      port: "3306",
      database: "mysql",
      username: "root",
      host: "localhost",
    },
  },
  {
    id: "sqlite",
    name: "SQLite",
    defaults: {
      port: "0",
      database: "",
      username: "",
      host: "",
    },
  },
  {
    id: "redis",
    name: "Redis",
    defaults: {
      port: "6379",
      database: "0",
      username: "",
      host: "localhost",
    },
  },
  {
    id: "mongodb",
    name: "MongoDB",
    defaults: {
      port: "27017",
      database: "test",
      username: "",
      host: "localhost",
    },
  },
];

type ConnectionMode = "params" | "string" | "file";

function NewConnectionPage() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [passwordPromptConnection, setPasswordPromptConnection] = useState<SavedConnection | null>(
    null,
  );
  const [mode, setMode] = useState<ConnectionMode>("params");
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [tested, setTested] = useState(false);
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

  const connect = useConnect();
  const testConnection = useTestConnection();
  const { canSave, currentSaved, maxSaved, isPro } = useCanSaveConnection();

  // Global keyboard shortcuts
  useGlobalShortcuts({
    onNewConnection: () => {
      // Already on new connection page, just refresh
      window.location.reload();
    },
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onOpenSettings: () => {
      void openSettingsWindow({ fallback: () => navigate({ to: "/settings" }) });
    },
  });

  const selectedDb = DATABASE_OPTIONS.find((db) => db.id === dbType)!;

  const handleDbSelect = (type: DatabaseType) => {
    const db = DATABASE_OPTIONS.find((d) => d.id === type)!;
    setDbType(type);
    setFormData((prev) => ({
      ...prev,
      host: db.defaults.host,
      port: db.defaults.port,
      database: db.defaults.database,
      username: db.defaults.username,
    }));
    if (type === "sqlite") {
      setMode("file");
    } else if (mode === "file") {
      setMode("params");
    }
    setTested(false);
    setErrors({});
  };

  const handleSelectSavedConnection = (savedConnection: SavedConnection) => {
    // If it's a connection string, it has the password embedded, so connect directly
    if ("connection_string" in savedConnection.config) {
      setPasswordPromptConnection(savedConnection);
    } else {
      // Need password for params-based connections
      setPasswordPromptConnection(savedConnection);
    }
  };

  const handleEditConnection = (savedConnection: SavedConnection) => {
    navigate({
      to: "/edit-connection/$connectionId",
      params: { connectionId: savedConnection.id },
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Required";

    if (mode === "params") {
      if (!formData.host.trim()) newErrors.host = "Required";
      if (dbType !== "redis" && !formData.database.trim()) newErrors.database = "Required";
      if (dbType !== "redis" && !formData.username.trim()) {
        newErrors.username = "Required";
      }
      const port = parseInt(formData.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        newErrors.port = "Invalid";
      }
    } else if (mode === "file") {
      if (!formData.connectionString.trim()) {
        newErrors.connectionString = "File path is required";
      }
    } else {
      if (!formData.connectionString.trim()) {
        newErrors.connectionString = "Required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getConfig = (): ConnectionConfig => {
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

    if (!canSave) {
      toast.error(`Saved connection limit reached. Free tier allows ${maxSaved} connections.`);
      return;
    }

    if (!validate()) return;

    const id = crypto.randomUUID();
    const config = getConfig();

    try {
      const tId = toast.loading("Connecting to database...");
      await connect.mutateAsync({
        id,
        name: formData.name,
        db_type: dbType,
        config,
      });
      toast.success("Connected successfully", { id: tId });
      navigate({ to: "/db/$connectionId", params: { connectionId: id } });
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    }
  };

  const handleTest = async () => {
    if (!validate()) return;

    const config = getConfig();

    try {
      const tId = toast.loading("Connecting to database...");
      await testConnection.mutateAsync(config);
      setTested(true);
      toast.success("Connection successful!", { id: tId });
    } catch (error) {
      setTested(false);
      toast.error(`Connection failed: ${error}`);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTested(false);
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
      return "redis://[:password@]host:6379[/db] or rediss:// for TLS, cluster: host1:6379,host2:6379";
    }
    if (dbType === "mongodb") {
      return "mongodb://[user:password@]localhost:27017/database";
    }
    return "postgresql://user:password@localhost:5432/database";
  };

  const getConnectionStringHelp = () => {
    if (dbType === "redis") {
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Standard:</strong> redis://:password@localhost:6379/0
          </p>
          <p>
            <strong>TLS/SSL:</strong> rediss://:password@localhost:6379/0
          </p>
          <p>
            <strong>Cluster:</strong> redis://host1:6379,redis://host2:6379,redis://host3:6379
          </p>
          <p>
            <strong>ACL (Redis 6+):</strong> redis://username:password@localhost:6379/0
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-card/20 text-foreground">
      {/* Titlebar drag region */}
      <div
        data-tauri-drag-region
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 justify-center overflow-auto px-6 pb-8 pt-5">
          <div className="w-full max-w-2xl space-y-5">
            <div className="rounded-2xl border border-border/60 bg-card/35 p-5 backdrop-blur">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  Add Connection
                  {!isPro && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({currentSaved}/{maxSaved})
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground">
                  Connect to a new database by providing connection details.
                </p>
              </div>
            </div>

            {!canSave && (
              <div className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 font-medium text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  Connection limit reached
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free tier allows {maxSaved} saved connections. Upgrade to Pro for unlimited.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void openSettingsWindow({ fallback: () => navigate({ to: "/settings" }) })
                  }
                  className="mt-3 rounded-lg"
                >
                  Go to Account Settings
                </Button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-2xl border border-border/60 bg-card/35 p-5 backdrop-blur"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  placeholder="My Database"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={cn("h-10 rounded-xl", errors.name && "border-destructive")}
                  disabled={!canSave}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dbType">Database Type</Label>
                  <select
                    id="dbType"
                    value={dbType}
                    onChange={(e) => handleDbSelect(e.target.value as DatabaseType)}
                    disabled={!canSave}
                    className="flex h-10 w-full rounded-xl border border-input bg-background/80 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {DATABASE_OPTIONS.map((db) => (
                      <option key={db.id} value={db.id}>
                        {db.name}
                      </option>
                    ))}
                  </select>
                </div>

                {dbType !== "sqlite" && (
                  <div className="space-y-2">
                    <Label htmlFor="mode">Connection Method</Label>
                    <select
                      id="mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ConnectionMode)}
                      disabled={!canSave}
                      className="flex h-10 w-full rounded-xl border border-input bg-background/80 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="params">Parameters</option>
                      <option value="string">Connection URL</option>
                    </select>
                  </div>
                )}
              </div>

              {mode === "params" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        placeholder={selectedDb.defaults.host}
                        value={formData.host}
                        onChange={(e) => updateField("host", e.target.value)}
                        className={cn("h-10 rounded-xl", errors.host && "border-destructive")}
                        disabled={!canSave}
                      />
                      {errors.host && <p className="text-xs text-destructive">{errors.host}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        placeholder={selectedDb.defaults.port}
                        value={formData.port}
                        onChange={(e) => updateField("port", e.target.value)}
                        className={cn("h-10 rounded-xl", errors.port && "border-destructive")}
                        disabled={!canSave}
                      />
                      {errors.port && <p className="text-xs text-destructive">{errors.port}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database">
                      {dbType === "redis" ? "Database Index" : "Database"}
                    </Label>
                    <Input
                      id="database"
                      placeholder={selectedDb.defaults.database}
                      value={formData.database}
                      onChange={(e) => updateField("database", e.target.value)}
                      className={cn("h-10 rounded-xl", errors.database && "border-destructive")}
                      disabled={!canSave}
                    />
                    {dbType === "redis" && (
                      <p className="text-xs text-muted-foreground">
                        Redis database index (0-15, default: 0)
                      </p>
                    )}
                    {errors.database && (
                      <p className="text-xs text-destructive">{errors.database}</p>
                    )}
                  </div>

                  {dbType === "redis" ? (
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className="h-10 rounded-xl"
                        disabled={!canSave}
                      />
                    </div>
                  ) : dbType !== "sqlite" ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder={selectedDb.defaults.username}
                          value={formData.username}
                          onChange={(e) => updateField("username", e.target.value)}
                          className={cn("h-10 rounded-xl", errors.username && "border-destructive")}
                          disabled={!canSave}
                        />
                        {errors.username && (
                          <p className="text-xs text-destructive">{errors.username}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) => updateField("password", e.target.value)}
                          className="h-10 rounded-xl"
                          disabled={!canSave}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : mode === "file" ? (
                <div className="space-y-2">
                  <Label htmlFor="connectionString">Database File</Label>
                  <div className="flex gap-2">
                    <Input
                      id="connectionString"
                      placeholder="Select a SQLite database file..."
                      value={formData.connectionString}
                      onChange={(e) => updateField("connectionString", e.target.value)}
                      className={cn(
                        "h-10 rounded-xl font-mono text-sm flex-1",
                        errors.connectionString && "border-destructive",
                      )}
                      disabled={!canSave}
                    />
                    <input
                      type="file"
                      accept=".db,.sqlite,.sqlite3,.db3"
                      className="hidden"
                      id="sqlite-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const path = (file as any).path || file.name;
                          updateField("connectionString", path);
                        }
                        e.target.value = "";
                      }}
                      disabled={!canSave}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => document.getElementById("sqlite-file-input")?.click()}
                      disabled={!canSave}
                      className="h-10 w-10 rounded-xl"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Browse for a .db, .sqlite, or .sqlite3 file
                  </p>
                  {errors.connectionString && (
                    <p className="text-xs text-destructive">{errors.connectionString}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="connectionString">Connection String</Label>
                  <Textarea
                    id="connectionString"
                    placeholder={getConnectionStringPlaceholder()}
                    value={formData.connectionString}
                    onChange={(e) => updateField("connectionString", e.target.value)}
                    className={cn(
                      "min-h-[100px] rounded-xl font-mono text-sm",
                      errors.connectionString && "border-destructive",
                    )}
                    disabled={!canSave}
                  />
                  {getConnectionStringHelp()}
                  {errors.connectionString && (
                    <p className="text-xs text-destructive">{errors.connectionString}</p>
                  )}
                </div>
              )}

              <Separator />
              <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 flex justify-end gap-3 rounded-b-2xl border-t border-border/60 bg-card/75 px-5 py-3 backdrop-blur">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: "/" })}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testConnection.isPending || !canSave}
                  className="rounded-xl"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : tested ? (
                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-500" />
                  ) : null}
                  Test Connection
                </Button>
                <Button
                  type="submit"
                  disabled={connect.isPending || !canSave}
                  className="rounded-xl"
                >
                  {connect.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectConnection={handleSelectSavedConnection}
        onEditConnection={handleEditConnection}
        onNewConnection={() => window.location.reload()}
      />
      <PasswordPromptDialog
        connection={passwordPromptConnection}
        open={passwordPromptConnection !== null}
        onOpenChange={(open) => !open && setPasswordPromptConnection(null)}
      />
    </div>
  );
}
