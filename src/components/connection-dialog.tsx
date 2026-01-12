import { useState } from "react";
import {
  Loader2,
  Database,
  Server,
  Cloud,
  CheckCircle2,
  Link2,
  AlertTriangle,
  Key,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  defaults: { port: string; database: string; username: string; host: string };
}

const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    icon: <Database className="h-4 w-4" />,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
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
    icon: <Server className="h-4 w-4" />,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500",
    defaults: {
      port: "3306",
      database: "mysql",
      username: "root",
      host: "localhost",
    },
  },
  {
    id: "libsql",
    name: "Turso",
    icon: <Cloud className="h-4 w-4" />,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500",
    defaults: {
      port: "443",
      database: "default",
      username: "",
      host: "turso.io",
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
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                New Connection
              </div>
              <Badge
                variant={isPro ? "default" : "secondary"}
                className="text-xs"
              >
                {currentSaved}/{isPro ? "∞" : maxSaved}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Saved Connection Limit Warning */}
          {!canSave && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-amber-500">
                  Connection limit reached
                </p>
                <p className="text-xs text-muted-foreground">
                  Free tier allows {maxSaved} saved connections. Delete an
                  existing connection or upgrade to Pro for unlimited
                  connections.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLicenseSettingsOpen(true)}
                  className="gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" />
                  Enter License Key
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Connection Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Database"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={cn(errors.name && "border-destructive")}
                disabled={!canSave}
              />
            </div>

            {/* Database Type Selector */}
            <div className="space-y-2">
              <Label>Database</Label>
              <div className="flex gap-2">
                {DATABASE_OPTIONS.map((db) => (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => handleDbSelect(db.id)}
                    disabled={!canSave}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-colors",
                      dbType === db.id
                        ? `${db.borderColor} ${db.bgColor} ${db.color}`
                        : "border-border hover:bg-accent",
                      !canSave && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {db.icon}
                    {db.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-md">
              <button
                type="button"
                onClick={() => setMode("params")}
                disabled={!canSave}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors",
                  mode === "params"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  !canSave && "opacity-50 cursor-not-allowed",
                )}
              >
                Parameters
              </button>
              <button
                type="button"
                onClick={() => setMode("string")}
                disabled={!canSave}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-sm font-medium transition-colors",
                  mode === "string"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  !canSave && "opacity-50 cursor-not-allowed",
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                URL
              </button>
            </div>

            {mode === "params" ? (
              <div className="space-y-3">
                {/* Host & Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="host" className="text-xs">
                      Host
                    </Label>
                    <Input
                      id="host"
                      placeholder={selectedDb.defaults.host}
                      value={formData.host}
                      onChange={(e) => updateField("host", e.target.value)}
                      className={cn("h-9", errors.host && "border-destructive")}
                      disabled={!canSave}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="port" className="text-xs">
                      Port
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder={selectedDb.defaults.port}
                      value={formData.port}
                      onChange={(e) => updateField("port", e.target.value)}
                      className={cn("h-9", errors.port && "border-destructive")}
                      disabled={!canSave}
                    />
                  </div>
                </div>

                {/* Database */}
                <div className="space-y-1">
                  <Label htmlFor="database" className="text-xs">
                    Database
                  </Label>
                  <Input
                    id="database"
                    placeholder={selectedDb.defaults.database}
                    value={formData.database}
                    onChange={(e) => updateField("database", e.target.value)}
                    className={cn(
                      "h-9",
                      errors.database && "border-destructive",
                    )}
                    disabled={!canSave}
                  />
                </div>

                {/* Username & Password */}
                {dbType !== "libsql" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="username" className="text-xs">
                        Username
                      </Label>
                      <Input
                        id="username"
                        placeholder={selectedDb.defaults.username}
                        value={formData.username}
                        onChange={(e) =>
                          updateField("username", e.target.value)
                        }
                        className={cn(
                          "h-9",
                          errors.username && "border-destructive",
                        )}
                        disabled={!canSave}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password" className="text-xs">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          updateField("password", e.target.value)
                        }
                        className="h-9"
                        disabled={!canSave}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="password" className="text-xs">
                      Auth Token{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your Turso auth token"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      className="h-9"
                      disabled={!canSave}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="connectionString" className="text-xs">
                  Connection String
                </Label>
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testConnection.isPending || !canSave}
                className="gap-1.5"
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : tested ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : null}
                Test
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={connect.isPending || !canSave}
              >
                {connect.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
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
