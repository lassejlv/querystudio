import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useThemeStore } from "@/lib/theme-store";
import { useThemeImport } from "@/lib/use-theme-import";
import { Upload, Trash2 } from "lucide-react";

export function ThemeSelector() {
  const { getAllThemes, activeTheme: activeThemeId, themes: themeStore, setActiveTheme, removeCustomTheme } = useThemeStore();

  const { importThemeFromJson, importAndApplyTheme } = useThemeImport();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");

  const themes = getAllThemes();
  const activeTheme = themeStore[activeThemeId] || themes[0];

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importAndApplyTheme(file);
    }
  };

  const handleJsonImport = () => {
    if (importThemeFromJson(importJson)) {
      setImportJson("");
      setImportDialogOpen(false);
    }
  };

  const handleRemoveTheme = (themeId: string) => {
    if (confirm("Are you sure you want to remove this theme?")) {
      removeCustomTheme(themeId);
    }
  };

  const customThemes = themes.filter((theme) => !theme.isBuiltIn);
  const builtInThemes = themes.filter((theme) => theme.isBuiltIn);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="theme-select">Theme:</Label>
        <Select value={activeTheme.id} onValueChange={setActiveTheme}>
          <SelectTrigger id="theme-select" className="w-48">
            <SelectValue placeholder="Select theme...">
              {activeTheme.displayName || activeTheme.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-sm font-semibold">Built-in Themes</div>
            {builtInThemes.map((theme) => (
              <SelectItem key={theme.id} value={theme.id}>
                {theme.displayName || theme.name}
              </SelectItem>
            ))}
            {customThemes.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-sm font-semibold mt-1">Custom Themes</div>
                {customThemes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.displayName || theme.name}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Theme
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Theme</DialogTitle>
              <DialogDescription>
                Import a theme from a JSON file or paste the JSON content.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-import">Import from file:</Label>
                <Input
                  id="file-import"
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="mt-1"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              <div>
                <Label htmlFor="json-import">Paste JSON:</Label>
                <Textarea
                  id="json-import"
                  placeholder="Paste theme JSON here..."
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="mt-1 min-h-32"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleJsonImport} disabled={!importJson}>
                  Import
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {customThemes.length > 0 && (
        <div className="space-y-2">
          <Label>Custom Themes:</Label>
          <div className="space-y-1">
            {customThemes.map((theme) => (
              <div key={theme.id} className="flex items-center justify-between p-2 rounded border">
                <div>
                  <div className="font-medium">{theme.displayName || theme.name}</div>
                  {theme.description && (
                    <div className="text-sm text-muted-foreground">{theme.description}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTheme(theme.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
