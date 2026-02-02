import { betterAuth } from "better-auth";
import {
  captcha,
  oAuthProxy,
  oneTimeToken,
  haveIBeenPwned,
  lastLoginMethod,
} from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "drizzle";
import { zeroId } from "zero-id";
import { emailer } from "./emailer";
import { env } from "./env";
import { render } from "@react-email/render";
import VerifyEmail from "@/emails/verify-email";
import { polar } from "./polar";
import { user } from "drizzle/schema/auth";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    additionalFields: {
      polarCustomerId: {
        type: "string",
        required: false,
      },
      isPro: {
        type: "boolean",
        required: false,
      },
      licenseKey: {
        type: "string",
        required: false,
      },
      cancelAtPeriodEnd: {
        type: "boolean",
        required: false,
      },
      termsAndPrivacyAccepted: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async ({ email, name }) => {
          try {
            const newCustomer = await polar.customers.create({ email: email, name: name });
            await db
              .update(user)
              .set({ polarCustomerId: newCustomer.id })
              .where(eq(user.email, email));
            console.log(`Create new polar customer for user ${name} with email ${email}`);
          } catch (error) {
            console.error(error);
          }
        },
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
    database: {
      generateId: () => zeroId({ randomLength: 32 }),
    },
    // Disable CSRF check to allow desktop apps (Tauri) that don't send Origin headers
    // Security is maintained through the one-time token mechanism which is single-use and time-limited
    disableCSRFCheck: true,
  },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async (data) => {
      await emailer.emails.send({
        from: env.USESEND_FROM,
        to: data.user.email,
        subject: "QueryStudio - Verify your email",
        html: await render(<VerifyEmail url={data.url} />),
      });
    },
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectURI: "https://querystudio.dev/api/auth/callback/github",
    },
  },
  plugins: [
    haveIBeenPwned(),
    lastLoginMethod(),
    oAuthProxy(),
    oneTimeToken(),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY,
    }),
  ],
  trustedOrigins: [
    "http://localhost:3000",
    "https://querystudio.dev",
    "tauri://localhost",
    "http://tauri.localhost",
    "http://localhost:1420",
    "querystudio://**",
  ],
});
