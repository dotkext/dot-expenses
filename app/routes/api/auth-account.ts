import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Route } from "./+types/auth-account";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { invalidateAllSessions, sessionCookieClear } from "@/server/auth.service";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(
    z.object({ confirm: z.string().trim().toLowerCase() }),
    await readBody(request),
  );

  if (input.confirm !== user.email.toLowerCase()) {
    apiError("errors.confirmEmail", 400);
  }

  await invalidateAllSessions(user.id);
  // cascades: sessions, oauth, accounts, categories, merchants, transactions,
  // recurring rules, budgets, dashboard layout, rate overrides
  await db.delete(users).where(eq(users.id, user.id));

  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieClear(request) } });
}
