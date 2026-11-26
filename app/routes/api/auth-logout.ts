import type { Route } from "./+types/auth-logout";

import {
  getCookie,
  invalidateSession,
  SESSION_COOKIE,
  sessionCookieClear,
} from "@/server/auth.service";
import { assertSameOrigin } from "@/server/http";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);

  const token = getCookie(request, SESSION_COOKIE);
  if (token) await invalidateSession(token);

  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieClear(request) } });
}
