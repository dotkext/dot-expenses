import type { Route } from "./+types/auth-sessions";

import { invalidateAllSessions, sessionCookieClear } from "@/server/auth.service";
import { assertSameOrigin, requireApiUser } from "@/server/http";

/** Sign out of every device (all sessions), including the current one. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  await invalidateAllSessions(user.id);

  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieClear(request) } });
}
