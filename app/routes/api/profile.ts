import { eq, sql } from "drizzle-orm";

import type { Route } from "./+types/profile";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireApiUser, apiError, assertSameOrigin, parseBody, readBody } from "@/server/http";
import { profileSchema } from "@/lib/validation";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(profileSchema, await readBody(request));

  if (input.email !== user.email.toLowerCase()) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, input.email))
      .limit(1);
    if (existing[0]) apiError("errors.emailTaken", 409);
  }

  await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      currency: input.currency,
      locale: input.locale,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return Response.json({ ok: true, currency: input.currency, locale: input.locale });
}
