import { useState, useEffect } from "react";
import {
  Key,
  Check,
  X,
  Loader2,
  Monitor,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useLicenseStore } from "@/lib/store";
import type { DeviceInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LicenseSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LicenseSettings({ open, onOpenChange }: LicenseSettingsProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { status, setStatus, setLoading } = useLicenseStore();

  // Load license status when dialog opens
  useEffect(() => {
    if (open) {
      loadLicenseStatus();
    }
  }, [open]);

  const loadLicenseStatus = async () => {
    try {
      setLoading(true);
      const licenseStatus = await api.licenseGetStatus();
      setStatus(licenseStatus);

      // If pro, load devices
      if (licenseStatus.is_pro && licenseStatus.is_activated) {
        await loadDevices();
      }
    } catch (err) {
      console.error("Failed to load license status:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const deviceList = await api.licenseListDevices();
      setDevices(deviceList);
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setIsActivating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.licenseActivate(licenseKey.trim());

      if (result.success) {
        setSuccessMessage("License activated successfully!");
        setLicenseKey("");
        await loadLicenseStatus();
      } else {
        setError(result.error || result.message || "Activation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.licenseDeactivate();

      if (result.success) {
        setSuccessMessage("Device deactivated successfully");
        setDevices([]);
        await loadLicenseStatus();
      } else {
        setError(result.error || result.message || "Deactivation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivation failed");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const result = await api.licenseVerify();

      if (result.valid && result.active) {
        setSuccessMessage("License verified successfully");
        await loadLicenseStatus();
      } else {
        setError(
          result.error || result.message || "License verification failed",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const isPro = status?.is_pro && status?.is_activated;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            License Settings
          </DialogTitle>
          <DialogDescription>Manage your QueryStudio license</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-500">
              {successMessage}
            </div>
          )}

          {!isPro ? (
            /* Activation Form */
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="license-key">License Key</Label>
                <Input
                  id="license-key"
                  type="text"
                  placeholder="Enter your license key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                />
              </div>
              <Button
                onClick={handleActivate}
                disabled={isActivating || !licenseKey.trim()}
                className="w-full"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>Activate</>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Don't have a license?{" "}
                <a
                  href="https://querystudio.dev/#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get Pro
                </a>
              </p>
            </div>
          ) : (
            /* Pro User Actions */
            <div className="space-y-4">
              {/* Devices List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Active Devices</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadDevices}
                    disabled={isLoadingDevices}
                  >
                    <RefreshCw
                      className={cn(
                        "h-3 w-3",
                        isLoadingDevices && "animate-spin",
                      )}
                    />
                  </Button>
                </div>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {isLoadingDevices ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : devices.length > 0 ? (
                    devices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{device.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.osType || "Unknown OS"}
                              {device.lastSeenAt &&
                                ` · Last seen ${new Date(device.lastSeenAt).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={device.active ? "default" : "secondary"}
                        >
                          {device.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No devices found
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="flex-1"
                >
                  {isVerifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Verify
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                  className="flex-1"
                >
                  {isDeactivating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Deactivate
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
