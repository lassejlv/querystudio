import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  oneTimeTokenClient,
  lastLoginMethodClient,
} from "better-auth/client/plugins";
import { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [lastLoginMethodClient(), inferAdditionalFields<typeof auth>(), oneTimeTokenClient()],
});
