import { createAuthClient } from "better-auth/react";
import { oneTimeTokenClient } from "better-auth/client/plugins";
import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";

const AUTH_URL = "https://querystudio.dev";
const DESKTOP_AUTH_PATH = "/auth/desktop";
const DEEP_LINK_CALLBACK_PATH = "auth/callback";

/**
 * Custom fetch implementation for Tauri that ensures Origin header is set
 */
async function tauriFetchWithOrigin(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (!headers.has("Origin")) {
    headers.set("Origin", "tauri://localhost");
  }

  return tauriFetch(input, {
    ...init,
    headers,
  });
}

/**
 * Custom fetch implementation that uses Tauri's HTTP plugin on macOS
 * and regular fetch elsewhere
 */
function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isTauri() && platform() === "macos" && window.location.protocol === "tauri:") {
    return tauriFetchWithOrigin(input, init);
  }
  return fetch(input, init);
}

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [oneTimeTokenClient()],
  fetchOptions: {
    customFetchImpl: customFetch,
  },
});

// Extended user type that includes custom fields from the server
// The server adds these via additionalFields in the auth config
export interface ExtendedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Custom fields added by the server
  polarCustomerId?: string | null;
  isPro?: boolean | null;
  licenseKey?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  termsAndPrivacyAccepted: {
    type: "boolean";
    required: false;
    defaultValue: false;
  };
}

/**
 * Sign in with GitHub using OAuth flow.
 * For Tauri desktop apps, this opens the web-based auth page in the system browser.
 * The web page handles the OAuth flow and redirects back via deep-link.
 */
export async function signInWithGithub(): Promise<void> {
  if (isTauri()) {
    // For Tauri apps, open the desktop auth page in the system browser
    // This page handles the OAuth flow entirely in the browser context,
    // avoiding cookie/state mismatch issues between Tauri and the browser
    const authUrl = `${AUTH_URL}${DESKTOP_AUTH_PATH}?callback=${encodeURIComponent(DEEP_LINK_CALLBACK_PATH)}`;
    await openUrl(authUrl);
  } else {
    // For web, use regular redirect flow
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/",
    });
  }
}
