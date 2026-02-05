import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { polar } from "@/lib/polar";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { db } from "drizzle";
import { eq } from "drizzle-orm";
import { user as userTable } from "drizzle/schema/auth";
import z from "zod";

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ plan: z.enum(["monthly", "annually", "onetime"]) }))
  .handler(async ({ data }) => {
    const req = getRequest();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) throw new Error("Unauthorized");

    const { user } = session;

    if (!user.termsAndPrivacyAccepted)
      throw new Error("Please accept terms and privacy before creating a checkout session");

    let customerId = "";

    if (!user.polarCustomerId) {
      const newCustomer = await polar.customers.create({ email: user.email, name: user.name });
      await db
        .update(userTable)
        .set({ polarCustomerId: newCustomer.id })
        .where(eq(userTable.id, user.id));
      customerId = newCustomer.id;
    } else {
      customerId = user.polarCustomerId;
    }

    let productId: string;
    if (data.plan === "monthly") {
      productId = env.POLAR_MONTHLY_ID;
    } else if (data.plan === "annually") {
      if (!env.POLAR_ANNUALLY_ID) {
        throw new Error("Annual plan is not available at this time");
      }
      productId = env.POLAR_ANNUALLY_ID;
    } else {
      productId = env.POLAR_PRICING_ID;
    }

    const checkout = await polar.checkouts.create({
      customerId,
      products: [productId],
      allowDiscountCodes: true,
      ...(data.plan === "onetime" &&
        env.POLAR_EARLY_BIRD_DISCOUNT && { discountId: env.POLAR_EARLY_BIRD_DISCOUNT }),
    });

    return { url: checkout.url };
  });

export const createCustomerPortal = createServerFn().handler(async () => {
  const req = getRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new Error("Unauthorized");

  const { user } = session;

  if (!user.polarCustomerId) throw new Error("No active customerID");

  const portal = await polar.customerSessions.create({
    customerId: user.polarCustomerId,
  });

  return { url: portal.customerPortalUrl };
});

export const getSubscriptionDetails = createServerFn().handler(async () => {
  const req = getRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new Error("Unauthorized");

  const { user } = session;

  if (!user.polarCustomerId) throw new Error("No active customerID");
  if (!user.polarSubscriptionId) return null;

  const subscription = await polar.subscriptions.get({ id: user.polarSubscriptionId });

  return subscription;
});
