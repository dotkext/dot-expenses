import { eq } from "drizzle-orm";

import type { Route } from "./+types/auth-password";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  hashPassword,
  invalidateAllSessions,
  verifyPassword,
} from "@/server/auth.service";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { passwordChangeSchema } from "@/lib/validation";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (!user.passwordHash) {
    apiError("errors.noPassword", 400);
  }

  const input = parseBody(passwordChangeSchema, await readBody(request));

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    apiError("errors.currentPasswordIncorrect", 401);
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Sign out everywhere; the client redirects to login.
  await invalidateAllSessions(user.id);

  return Response.json({ ok: true });
}
