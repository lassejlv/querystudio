import { env } from "@/lib/env";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "drizzle";
import { eq } from "drizzle-orm";
import { user as userTable } from "drizzle/schema/auth";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

export const Route = createFileRoute("/api/polar/webhooks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text();
          const headers: Record<string, string> = {};
          request.headers.forEach((value, key) => {
            headers[key] = value;
          });

          const event = validateEvent(body, headers, env.POLAR_WEBHOOK_SECRET);

          switch (event.type) {
            case "order.paid": {
              const { customerId } = event.data;

              if (customerId) {
                await db
                  .update(userTable)
                  .set({ isPro: true })
                  .where(eq(userTable.polarCustomerId, customerId));

                console.log(`[Polar Webhook] Order paid for customer: ${customerId}`);
              }
              break;
            }

            case "subscription.active": {
              const { customerId, id } = event.data;

              if (customerId) {
                await db
                  .update(userTable)
                  .set({ isPro: true, polarSubscriptionId: id })
                  .where(eq(userTable.polarCustomerId, customerId));

                console.log(`[Polar Webhook] Subscription activated for customer: ${customerId}`);
              }
              break;
            }

            case "subscription.canceled":
            case "subscription.revoked": {
              const { customerId } = event.data;

              if (customerId) {
                await db
                  .update(userTable)
                  .set({ isPro: false })
                  .where(eq(userTable.polarCustomerId, customerId));

                console.log(
                  `[Polar Webhook] Subscription ${event.type === "subscription.canceled" ? "canceled" : "revoked"} for customer: ${customerId}`,
                );
              }
              break;
            }

            default:
              console.log(`[Polar Webhook] Unhandled event type: ${event.type}`);
          }

          return new Response("Webhook received", { status: 200 });
        } catch (error) {
          if (error instanceof WebhookVerificationError) {
            console.error("[Polar Webhook] Verification failed:", error.message);
            return new Response("Webhook verification failed", { status: 400 });
          }

          console.error("[Polar Webhook] Error:", error);
          return new Response("Internal server error", { status: 500 });
        }
      },
    },
  },
});
