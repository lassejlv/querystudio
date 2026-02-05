import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { db } from "drizzle";
import { eq } from "drizzle-orm";
import { user as userTable } from "drizzle/schema/auth";
import z from "zod";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

  return session.user;
});

export const updateNameFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name } = data;

    await db.update(userTable).set({ name }).where(eq(userTable.id, session.user.id));

    return { success: true };
  });

export const acceptTermsAndPrivacyFn = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await db
    .update(userTable)
    .set({ termsAndPrivacyAccepted: true })
    .where(eq(userTable.id, session.user.id));

  return { success: true };
});
