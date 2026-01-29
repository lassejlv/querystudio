import { createAuthClient } from "better-auth/react";
import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";

const AUTH_URL = "https://querystudio.dev";

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
