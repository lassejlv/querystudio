import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useConnect, useTestConnection } from "@/lib/hooks";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/lib/types";

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionDialog({ open, onOpenChange }: ConnectionDialogProps) {
  const [testing, setTesting] = useState(false);
  const [mode, setMode] = useState<"params" | "string">("params");
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

  const validateParams = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.host.trim()) newErrors.host = "Host is required";
    if (!formData.database.trim()) newErrors.database = "Database is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
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

  const validate = () => (mode === "params" ? validateParams() : validateString());

  const getConfig = (): ConnectionConfig => {
    if (mode === "string") {
      return { connection_string: formData.connectionString };
    }
    return {
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
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const id = crypto.randomUUID();
    const config = getConfig();

    try {
      await connect.mutateAsync({ id, name: formData.name, config });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New PostgreSQL Connection</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              placeholder="My Database"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "params" | "string")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="params">Parameters</TabsTrigger>
              <TabsTrigger value="string">Connection String</TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    placeholder="localhost"
                    value={formData.host}
                    onChange={(e) => updateField("host", e.target.value)}
                  />
                  {errors.host && (
                    <p className="text-xs text-red-500">{errors.host}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="5432"
                    value={formData.port}
                    onChange={(e) => updateField("port", e.target.value)}
                  />
                  {errors.port && (
                    <p className="text-xs text-red-500">{errors.port}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  placeholder="postgres"
                  value={formData.database}
                  onChange={(e) => updateField("database", e.target.value)}
                />
                {errors.database && (
                  <p className="text-xs text-red-500">{errors.database}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="postgres"
                    value={formData.username}
                    onChange={(e) => updateField("username", e.target.value)}
                  />
                  {errors.username && (
                    <p className="text-xs text-red-500">{errors.username}</p>
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
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="string" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connectionString">Connection String</Label>
                <Textarea
                  id="connectionString"
                  placeholder="postgresql://user:password@localhost:5432/database"
                  value={formData.connectionString}
                  onChange={(e) => updateField("connectionString", e.target.value)}
                  className="min-h-[80px] font-mono text-sm"
                />
                {errors.connectionString && (
                  <p className="text-xs text-red-500">{errors.connectionString}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Supports PostgreSQL connection URI or key-value format
                </p>
              </div>
            </TabsContent>
          </Tabs>

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
