import { createAuthClient } from "better-auth/react";
import { signInSocial, tauriFetchImpl } from "@daveyplate/better-auth-tauri";

const AUTH_URL = "https://querystudio.dev";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    customFetchImpl: tauriFetchImpl,
  },
});

export const AUTH_SCHEME = "querystudio";

// Helper function for social sign-in from desktop app
export async function signInWithProvider(provider: "github") {
  return signInSocial({
    authClient,
    provider,
  });
}
