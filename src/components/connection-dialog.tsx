import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useConnect,
  useTestConnection,
  useCanSaveConnection,
} from "@/lib/hooks";
import { toast } from "sonner";
import type { ConnectionConfig, DatabaseType } from "@/lib/types";
import { LicenseSettings } from "@/components/license-settings";

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
];

type ConnectionMode = "params" | "string";

export function ConnectionDialog({
  open,
  onOpenChange,
}: ConnectionDialogProps) {
  const [mode, setMode] = useState<ConnectionMode>("params");
  const [dbType, setDbType] = useState<DatabaseType>("postgres");
  const [tested, setTested] = useState(false);
  const [licenseSettingsOpen, setLicenseSettingsOpen] = useState(false);
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
    setTested(false);
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Required";

    if (mode === "params") {
      if (!formData.host.trim()) newErrors.host = "Required";
      if (!formData.database.trim()) newErrors.database = "Required";
      if (dbType !== "libsql" && !formData.username.trim()) {
        newErrors.username = "Required";
      }
      const port = parseInt(formData.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        newErrors.port = "Invalid";
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

  const resetForm = () => {
    setFormData({
      name: "",
      host: "localhost",
      port: "5432",
      database: "postgres",
      username: "postgres",
      password: "",
      connectionString: "",
    });
    setDbType("postgres");
    setErrors({});
    setTested(false);
    setMode("params");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSave) {
      toast.error(
        `Saved connection limit reached. Free tier allows ${maxSaved} connections.`,
      );
      return;
    }

    if (!validate()) return;

    const id = crypto.randomUUID();
    const config = getConfig();

    try {
      await connect.mutateAsync({
        id,
        name: formData.name,
        db_type: dbType,
        config,
      });
      toast.success("Connected successfully");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error(`Connection failed: ${error}`);
    }
  };

  const handleTest = async () => {
    if (!validate()) return;

    const config = getConfig();

    try {
      await testConnection.mutateAsync(config);
      setTested(true);
      toast.success("Connection successful!");
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
    if (dbType === "libsql") {
      return "libsql://your-database.turso.io?authToken=your-token";
    }
    return "postgresql://user:password@localhost:5432/database";
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add Connection
              {!isPro && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({currentSaved}/{maxSaved})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {!canSave && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Connection limit reached
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Free tier allows {maxSaved} saved connections.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLicenseSettingsOpen(true)}
                className="mt-2"
              >
                <Key className="mr-1.5 h-3 w-3" />
                Enter License Key
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="My Database"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={cn(errors.name && "border-destructive")}
                disabled={!canSave}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dbType">Database Type</Label>
                <select
                  id="dbType"
                  value={dbType}
                  onChange={(e) =>
                    handleDbSelect(e.target.value as DatabaseType)
                  }
                  disabled={!canSave}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DATABASE_OPTIONS.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mode">Connection Method</Label>
                <select
                  id="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ConnectionMode)}
                  disabled={!canSave}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="params">Parameters</option>
                  <option value="string">Connection URL</option>
                </select>
              </div>
            </div>

            {mode === "params" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      placeholder={selectedDb.defaults.host}
                      value={formData.host}
                      onChange={(e) => updateField("host", e.target.value)}
                      className={cn(errors.host && "border-destructive")}
                      disabled={!canSave}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder={selectedDb.defaults.port}
                      value={formData.port}
                      onChange={(e) => updateField("port", e.target.value)}
                      className={cn(errors.port && "border-destructive")}
                      disabled={!canSave}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="database">Database</Label>
                  <Input
                    id="database"
                    placeholder={selectedDb.defaults.database}
                    value={formData.database}
                    onChange={(e) => updateField("database", e.target.value)}
                    className={cn(errors.database && "border-destructive")}
                    disabled={!canSave}
                  />
                </div>

                {dbType !== "libsql" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder={selectedDb.defaults.username}
                        value={formData.username}
                        onChange={(e) =>
                          updateField("username", e.target.value)
                        }
                        className={cn(errors.username && "border-destructive")}
                        disabled={!canSave}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          updateField("password", e.target.value)
                        }
                        disabled={!canSave}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="password">
                      Auth Token{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your Turso auth token"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      disabled={!canSave}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="connectionString">Connection String</Label>
                <Textarea
                  id="connectionString"
                  placeholder={getConnectionStringPlaceholder()}
                  value={formData.connectionString}
                  onChange={(e) =>
                    updateField("connectionString", e.target.value)
                  }
                  className={cn(
                    "min-h-[80px] font-mono text-sm",
                    errors.connectionString && "border-destructive",
                  )}
                  disabled={!canSave}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={testConnection.isPending || !canSave}
              >
                {testConnection.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : tested ? (
                  <CheckCircle2 className="mr-1.5 h-4 w-4 text-green-500" />
                ) : null}
                Test
              </Button>
              <Button type="submit" disabled={connect.isPending || !canSave}>
                {connect.isPending && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Connect
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <LicenseSettings
        open={licenseSettingsOpen}
        onOpenChange={setLicenseSettingsOpen}
      />
    </>
  );
}
