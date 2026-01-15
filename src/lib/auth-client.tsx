import { createAuthClient } from "better-auth/react";
import { tauriFetchImpl } from "@daveyplate/better-auth-tauri";

const AUTH_URL = "https://querystudio.dev";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    customFetchImpl: tauriFetchImpl,
  },
});
