import { createAuthClient } from "better-auth/react";
import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";
import {  openUrl } from "@tauri-apps/plugin-opener";

const AUTH_URL = "https://querystudio.dev";
const DEEP_LINK_CALLBACK = "querystudio://auth/callback";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    customFetchImpl: (...params) =>
      isTauri() &&
      platform() === "macos" &&
      window.location.protocol === "tauri:"
        ? tauriFetch(...params)
        : fetch(...params),
  },
});

/**
 * Sign in with GitHub using OAuth flow.
 * For Tauri desktop apps, this opens the browser and uses deep-link callback.
 */
export async function signInWithGithub(): Promise<void> {
  if (isTauri()) {
    // For Tauri apps, get the redirect URL and open in external browser
    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: DEEP_LINK_CALLBACK,
      disableRedirect: true,
    });

    if (result.data?.url) {
      // Open the OAuth URL in the system browser
      await openUrl(result.data.url);
    } else if (result.error) {
      throw new Error(
        result.error.message || "Failed to initiate GitHub sign-in",
      );
    }
  } else {
    // For web, use regular redirect flow
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    });
  }
}
