import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAIQueryStore } from "@/lib/store";
import { ThemeSelector } from "./theme-selector";

interface AppSettingsProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AppSettings({ open, onOpenChange, trigger }: AppSettingsProps) {
  const statusBarVisible = useAIQueryStore((s) => s.statusBarVisible);
  const setStatusBarVisible = useAIQueryStore((s) => s.setStatusBarVisible);
  const sidebarCollapsed = useAIQueryStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAIQueryStore((s) => s.setSidebarCollapsed);
  const autoReconnect = useAIQueryStore((s) => s.autoReconnect);
  const setAutoReconnect = useAIQueryStore((s) => s.setAutoReconnect);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your QueryStudio experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Behavior Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Behavior</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-reconnect" className="text-sm font-normal">
                  Auto-reconnect
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically connect to last database on launch
                </p>
              </div>
              <Switch
                id="auto-reconnect"
                checked={autoReconnect}
                onCheckedChange={setAutoReconnect}
              />
            </div>
          </div>

          {/* Appearance Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Appearance</h4>

            <div className="space-y-4">
              <ThemeSelector />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="status-bar" className="text-sm font-normal">
                  Status Bar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show connection status, query times, and cursor position
                </p>
              </div>
              <Switch
                id="status-bar"
                checked={statusBarVisible}
                onCheckedChange={setStatusBarVisible}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="sidebar-collapsed"
                  className="text-sm font-normal"
                >
                  Collapse Sidebar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Minimize the sidebar to show only icons
                </p>
              </div>
              <Switch
                id="sidebar-collapsed"
                checked={sidebarCollapsed}
                onCheckedChange={setSidebarCollapsed}
              />
            </div>
          </div>

          {/* Keyboard Shortcuts Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">
              Keyboard Shortcuts
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Toggle Sidebar</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌘B
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Toggle AI Panel</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌥⌘B
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Run Query</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌘↵
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Command Palette</span>
                <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
