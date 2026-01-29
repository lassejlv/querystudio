import { useEffect, useCallback } from "react";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isTauri } from "@tauri-apps/api/core";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const AUTH_CALLBACK_HOST = "auth";
const AUTH_CALLBACK_PATHNAME = "/callback";

/**
 * Hook that listens for deep-link auth callbacks and verifies the one-time token.
 * Should be used in the root component of the app.
 */
export function useAuthDeepLink() {
  // Get the refetch function from useSession to trigger UI updates
  const { refetch } = authClient.useSession();

  const handleDeepLinkUrl = useCallback(
    async (url: string) => {
      try {
        // Parse the deep-link URL
        // Expected format: querystudio://auth/callback?token=xxx
        const parsedUrl = new URL(url);

        // Check if this is an auth callback
        // URL format: querystudio://auth/callback?token=xxx
        // Parsed as: host="auth", pathname="/callback"
        const isAuthCallback =
          (parsedUrl.host === AUTH_CALLBACK_HOST &&
            parsedUrl.pathname === AUTH_CALLBACK_PATHNAME) ||
          parsedUrl.pathname.includes("auth/callback");

        if (!isAuthCallback) {
          return;
        }

        // Check if the user cancelled
        const cancelled = parsedUrl.searchParams.get("cancelled");
        if (cancelled === "true") {
          // User cancelled, no action needed
          return;
        }

        // Get the one-time token from the URL
        const token = parsedUrl.searchParams.get("token");

        if (!token) {
          toast.error("Sign-in failed: No authentication token received");
          return;
        }

        // Verify the one-time token to establish a session
        // This will set up the session in Tauri's context
        const result = await authClient.oneTimeToken.verify({
          token,
        });

        if (result.error) {
          toast.error(result.error.message || "Failed to complete sign-in");
          return;
        }

        // Refetch the session to update the UI
        await refetch();

        toast.success("Signed in successfully!");
      } catch (error) {
        console.error("Failed to handle auth deep link:", error);
        toast.error("Failed to complete sign-in");
      }
    },
    [refetch],
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let cleanup: (() => void) | undefined;

    const setupDeepLinkListener = async () => {
      try {
        cleanup = await onOpenUrl((urls) => {
          for (const url of urls) {
            handleDeepLinkUrl(url);
          }
        });
      } catch (error) {
        console.error("Failed to setup deep link listener:", error);
      }
    };

    setupDeepLinkListener();

    return () => {
      cleanup?.();
    };
  }, [handleDeepLinkUrl]);
}
