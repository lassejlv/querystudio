import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Monitor, Smartphone, Trash2 } from "lucide-react";

type Session = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  expiresAt: Date;
  token: string;
  userId: string;
  updatedAt: Date;
};

export const Route = createFileRoute("/_authed/dashboard/security")({
  component: SecurityPage,
});

function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const { data: sessionsData, error } = await authClient.listSessions();
      if (error) throw new Error(error.message);

      // Get current session to identify it
      const { data: currentSession } = await authClient.getSession();
      if (currentSession?.session?.id) {
        setCurrentSessionId(currentSession.session.id);
      }

      setSessions(sessionsData || []);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const { error } = await authClient.revokeSession({ token: sessionId });
      if (error) throw new Error(error.message);

      toast.success("Session revoked");
      fetchSessions();
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message);

      toast.success("All other sessions signed out");
      fetchSessions();
    } catch {
      toast.error("Failed to sign out other sessions");
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceName = (userAgent: string | null) => {
    if (!userAgent) return "Unknown device";
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome")) return "Chrome";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
    if (ua.includes("edge")) return "Edge";
    if (ua.includes("opera")) return "Opera";
    return "Browser";
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Failed to update password", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-medium">Security</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your password and sessions.</p>

      <form onSubmit={handleChangePassword} className="mt-8 space-y-4">
        <div>
          <label htmlFor="current-password" className="text-sm font-medium">
            Current password
          </label>
          <Input
            id="current-password"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="new-password" className="text-sm font-medium">
            New password
          </label>
          <Input
            id="new-password"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm new password
          </label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
            className="mt-1.5"
          />
        </div>

        <Button type="submit" disabled={isLoading} size="sm">
          {isLoading ? "Updating..." : "Update password"}
        </Button>
      </form>

      <div className="mt-16 pt-8 border-t">
        <h2 className="text-sm font-medium">Sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your active sessions across devices.
        </p>

        {isLoadingSessions ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">No active sessions</div>
        ) : (
          <div className="mt-4 space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="py-3 flex items-center justify-between border-b last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(session.userAgent || null)}
                  <div>
                    <p className="text-sm">
                      {getDeviceName(session.userAgent || null)}
                      {session.id === currentSessionId && (
                        <span className="ml-2 text-xs text-primary">(Current)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress || "Unknown location"}
                    </p>
                  </div>
                </div>
                {session.id !== currentSessionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSession(session.token)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {sessions.length > 1 && (
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRevokeOtherSessions}>
            Sign out other sessions
          </Button>
        )}
      </div>
    </div>
  );
}
