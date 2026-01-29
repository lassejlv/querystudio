import { useEffect } from "react";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isTauri } from "@tauri-apps/api/core";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const AUTH_CALLBACK_PATH = "auth/callback";

/**
 * Hook that listens for deep-link auth callbacks and refreshes the session.
 * Should be used in the root component of the app.
 */
export function useAuthDeepLink() {
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
  }, []);
}

async function handleDeepLinkUrl(url: string) {
  try {
    // Parse the deep-link URL
    // Expected format: querystudio://auth/callback?...
    const parsedUrl = new URL(url);

    // Check if this is an auth callback
    if (parsedUrl.host === AUTH_CALLBACK_PATH || parsedUrl.pathname.includes(AUTH_CALLBACK_PATH)) {
      // Refresh the session to get the latest auth state
      // The server-side has already set up the session via cookies during OAuth
      await authClient.getSession({
        fetchOptions: {
          // Force a fresh fetch from the server
          cache: "no-cache",
        },
      });

      toast.success("Signed in successfully!");
    }
  } catch (error) {
    console.error("Failed to handle auth deep link:", error);
    toast.error("Failed to complete sign-in");
  }
}
