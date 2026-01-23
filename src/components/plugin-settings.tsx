// ============================================================================
// Plugin Settings Component
// ============================================================================
//
// This component provides a UI for managing plugins in the Settings page.
// Users can view installed plugins, enable/disable them, and import new ones.
//
// ============================================================================

import { useState, useRef } from "react";
import {
  Puzzle,
  Plus,
  Trash2,
  Info,
  Upload,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePluginStore,
  getPluginIcon,
  PLUGIN_ICONS,
  type PluginIconName,
  type InstalledPlugin,
} from "@/lib/plugin-store";
import { tabRegistry } from "@/lib/tab-sdk";
import { toast } from "sonner";

export function PluginSettings() {
  const plugins = usePluginStore((s) => s.plugins);
  const togglePlugin = usePluginStore((s) => s.togglePlugin);
  const uninstallPlugin = usePluginStore((s) => s.uninstallPlugin);
  const installPlugin = usePluginStore((s) => s.installPlugin);
  const hasPluginType = usePluginStore((s) => s.hasPluginType);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [addMode, setAddMode] = useState<"manual" | "import">("manual");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedFile, setImportedFile] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // New plugin form state
  const [newPlugin, setNewPlugin] = useState({
    type: "",
    displayName: "",
    description: "",
    author: "",
    version: "1.0.0",
    iconName: "puzzle" as PluginIconName,
    componentCode: "",
  });

  const resetForm = () => {
    setNewPlugin({
      type: "",
      displayName: "",
      description: "",
      author: "",
      version: "1.0.0",
      iconName: "puzzle",
      componentCode: "",
    });
    setImportedFile(null);
    setParseError(null);
    setAddMode("manual");
  };

  const handleTogglePlugin = (plugin: InstalledPlugin) => {
    togglePlugin(plugin.id, !plugin.enabled);

    if (plugin.enabled) {
      toast.info(`${plugin.displayName} disabled. Restart to apply changes.`);
    } else {
      toast.success(`${plugin.displayName} enabled. Restart to apply changes.`);
    }
  };

  const handleUninstall = (id: string) => {
    const plugin = plugins.find((p) => p.id === id);
    if (!plugin) return;

    if (plugin.isBundled) {
      toast.error("Cannot uninstall bundled plugins");
      return;
    }

    const success = uninstallPlugin(id);
    if (success) {
      tabRegistry.unregister(plugin.type);
      toast.success(`${plugin.displayName} uninstalled`);
    }
    setShowDeleteConfirm(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    const validExtensions = [".tsx", ".ts", ".jsx", ".js"];
    const ext = file.name.substring(file.name.lastIndexOf("."));
    if (!validExtensions.includes(ext)) {
      setParseError(
        `Invalid file type. Please select a ${validExtensions.join(", ")} file.`,
      );
      return;
    }

    try {
      const content = await file.text();
      setImportedFile({ name: file.name, content });
      setParseError(null);

      // Try to extract plugin metadata from the file
      const metadata = extractPluginMetadata(content);
      if (metadata) {
        setNewPlugin((p) => ({
          ...p,
          type: metadata.type || p.type,
          displayName: metadata.displayName || p.displayName,
          description: metadata.description || p.description,
          author: metadata.author || p.author,
          version: metadata.version || p.version,
          componentCode: content,
        }));
        toast.success("Plugin metadata extracted from file");
      } else {
        setNewPlugin((p) => ({
          ...p,
          componentCode: content,
        }));
        toast.info("File loaded. Please fill in the plugin details manually.");
      }
    } catch (error) {
      setParseError(`Failed to read file: ${error}`);
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const extractPluginMetadata = (
    content: string,
  ): Partial<typeof newPlugin> | null => {
    try {
      // Try to find @plugin comment block
      const pluginCommentMatch = content.match(
        /\/\*\s*@plugin\s*(\{[\s\S]*?\})\s*\*\//,
      );
      if (pluginCommentMatch) {
        const json = JSON.parse(pluginCommentMatch[1]);
        return {
          type: json.type,
          displayName: json.displayName,
          description: json.description,
          author: json.author,
          version: json.version,
        };
      }

      // Try to extract from export const plugin = { ... }
      const typeMatch = content.match(/type:\s*["']([^"']+)["']/);
      const displayNameMatch = content.match(/displayName:\s*["']([^"']+)["']/);

      if (typeMatch || displayNameMatch) {
        return {
          type: typeMatch?.[1],
          displayName: displayNameMatch?.[1],
        };
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleAddPlugin = () => {
    // Validate
    if (!newPlugin.type.trim()) {
      toast.error("Plugin type is required");
      return;
    }

    if (!newPlugin.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    // Check for duplicate type
    if (hasPluginType(newPlugin.type)) {
      toast.error(`A plugin with type "${newPlugin.type}" already exists`);
      return;
    }

    // Check if type conflicts with Tab SDK
    if (tabRegistry.has(newPlugin.type)) {
      toast.error(`Tab type "${newPlugin.type}" is already registered`);
      return;
    }

    // Install the plugin
    installPlugin({
      type: newPlugin.type.trim(),
      displayName: newPlugin.displayName.trim(),
      iconName: newPlugin.iconName,
      description: newPlugin.description.trim() || "Custom plugin",
      version: newPlugin.version.trim() || "1.0.0",
      author: newPlugin.author.trim() || "Unknown",
      enabled: true,
      priority: 50,
      experimental: false,
      isBundled: false,
      componentCode: newPlugin.componentCode || undefined,
      source: importedFile?.name,
    });

    toast.success(`${newPlugin.displayName} installed! Restart to use.`);

    resetForm();
    setShowAddDialog(false);
  };

  // Separate bundled and user plugins
  const bundledPlugins = plugins.filter((p) => p.isBundled);
  const userPlugins = plugins.filter((p) => !p.isBundled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plugins</h2>
        <p className="text-muted-foreground">
          Manage tab plugins to extend QueryStudio's functionality.
        </p>
      </div>
      <Separator />

      {/* Warning Banner */}
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            <p className="font-medium mb-1">Experimental Feature</p>
            <p>
              The plugin system is experimental. Only install plugins from
              sources you trust. Malicious plugins could potentially access your
              data.
            </p>
          </div>
        </div>
      </div>

      {/* Add Plugin Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Plugin
        </Button>
      </div>

      {/* User Plugins Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Installed Plugins</h3>

        {userPlugins.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Puzzle className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h4 className="mt-4 text-sm font-medium">No plugins installed</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Click "Add Plugin" to install a custom tab plugin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {userPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onToggle={() => handleTogglePlugin(plugin)}
                onUninstall={() => setShowDeleteConfirm(plugin.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bundled Plugins Section */}
      {bundledPlugins.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Built-in Plugins</h3>
          <p className="text-sm text-muted-foreground">
            These plugins are bundled with QueryStudio and cannot be
            uninstalled.
          </p>
          <div className="space-y-3">
            {bundledPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onToggle={() => handleTogglePlugin(plugin)}
                isBundled
              />
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <p className="font-medium mb-1">About Plugins</p>
            <p>
              Plugins add new tab types to QueryStudio. After installing or
              changing plugin settings, restart the application for changes to
              take effect.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tsx,.ts,.jsx,.js"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Add Plugin Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Plugin</DialogTitle>
            <DialogDescription>
              Register a new tab plugin by importing a file or entering details
              manually.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={addMode}
            onValueChange={(v) => setAddMode(v as "manual" | "import")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="gap-2">
                <Puzzle className="h-4 w-4" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-2">
                <Upload className="h-4 w-4" />
                Import File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4 pt-4">
              {/* File Import Section */}
              <div
                className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {importedFile ? (
                  <div className="space-y-2">
                    <FileCode className="mx-auto h-10 w-10 text-primary" />
                    <p className="font-medium">{importedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(importedFile.content.length / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImportedFile(null);
                        setNewPlugin((p) => ({ ...p, componentCode: "" }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Click to select a plugin file</p>
                    <p className="text-sm text-muted-foreground">
                      Supports .tsx, .ts, .jsx, .js files
                    </p>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {parseError}
                </div>
              )}

              {importedFile && (
                <div className="space-y-4">
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    Review and complete the plugin details:
                  </p>
                  <PluginFormFields
                    newPlugin={newPlugin}
                    setNewPlugin={setNewPlugin}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-4">
              <PluginFormFields
                newPlugin={newPlugin}
                setNewPlugin={setNewPlugin}
                showCodeField
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPlugin}
              disabled={!newPlugin.type.trim() || !newPlugin.displayName.trim()}
            >
              Add Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm !== null}
        onOpenChange={() => setShowDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uninstall Plugin</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall this plugin? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                showDeleteConfirm && handleUninstall(showDeleteConfirm)
              }
            >
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Plugin Form Fields Component
interface PluginFormState {
  type: string;
  displayName: string;
  description: string;
  author: string;
  version: string;
  iconName: PluginIconName;
  componentCode: string;
}

interface PluginFormFieldsProps {
  newPlugin: PluginFormState;
  setNewPlugin: React.Dispatch<React.SetStateAction<PluginFormState>>;
  showCodeField?: boolean;
}

function PluginFormFields({
  newPlugin,
  setNewPlugin,
  showCodeField,
}: PluginFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plugin-type">
          Plugin Type <span className="text-destructive">*</span>
        </Label>
        <Input
          id="plugin-type"
          placeholder="my-custom-tab"
          value={newPlugin.type}
          onChange={(e) =>
            setNewPlugin((p) => ({
              ...p,
              type: e.target.value.toLowerCase().replace(/\s+/g, "-"),
            }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Unique identifier for this plugin (lowercase, no spaces)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plugin-name">
          Display Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="plugin-name"
          placeholder="My Custom Tab"
          value={newPlugin.displayName}
          onChange={(e) =>
            setNewPlugin((p) => ({ ...p, displayName: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plugin-icon">Icon</Label>
        <Select
          value={newPlugin.iconName}
          onValueChange={(value) =>
            setNewPlugin((p) => ({
              ...p,
              iconName: value as PluginIconName,
            }))
          }
        >
          <SelectTrigger id="plugin-icon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PLUGIN_ICONS).map(([name, Icon]) => (
              <SelectItem key={name} value={name}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="capitalize">{name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plugin-description">Description</Label>
        <Input
          id="plugin-description"
          placeholder="What does this plugin do?"
          value={newPlugin.description}
          onChange={(e) =>
            setNewPlugin((p) => ({ ...p, description: e.target.value }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plugin-author">Author</Label>
          <Input
            id="plugin-author"
            placeholder="Your name"
            value={newPlugin.author}
            onChange={(e) =>
              setNewPlugin((p) => ({ ...p, author: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plugin-version">Version</Label>
          <Input
            id="plugin-version"
            placeholder="1.0.0"
            value={newPlugin.version}
            onChange={(e) =>
              setNewPlugin((p) => ({ ...p, version: e.target.value }))
            }
          />
        </div>
      </div>

      {showCodeField && (
        <div className="space-y-2">
          <Label htmlFor="plugin-code">Component Code (Optional)</Label>
          <Textarea
            id="plugin-code"
            placeholder="Paste your plugin component code here..."
            className="font-mono text-xs h-32"
            value={newPlugin.componentCode}
            onChange={(e) =>
              setNewPlugin((p) => ({ ...p, componentCode: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            The React component code for this plugin. This is stored for
            reference but won't be executed automatically.
          </p>
        </div>
      )}
    </div>
  );
}

// Plugin Card Component
interface PluginCardProps {
  plugin: InstalledPlugin;
  onToggle: () => void;
  onUninstall?: () => void;
  isBundled?: boolean;
}

function PluginCard({
  plugin,
  onToggle,
  onUninstall,
  isBundled,
}: PluginCardProps) {
  const Icon = getPluginIcon(plugin.iconName);

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            plugin.enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{plugin.displayName}</h4>
            <span className="text-xs text-muted-foreground">
              v{plugin.version}
            </span>
            {isBundled && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                BUNDLED
              </span>
            )}
            {plugin.experimental && (
              <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                EXPERIMENTAL
              </span>
            )}
            {plugin.source && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                IMPORTED
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            by {plugin.author} • Type: {plugin.type}
            {plugin.source && ` • Source: ${plugin.source}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={plugin.enabled} onCheckedChange={onToggle} />
        {!isBundled && onUninstall && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onUninstall}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
