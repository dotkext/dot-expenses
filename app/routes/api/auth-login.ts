import type { Route } from "./+types/auth-login";

import {
  createSession,
  loginWithPassword,
  rateLimit,
  sessionCookieSet,
} from "@/server/auth.service";
import { assertSameOrigin, parseBody, readBody } from "@/server/http";
import { loginSchema } from "@/lib/validation";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);

  const input = parseBody(loginSchema, await readBody(request));
  rateLimit(`login:${input.email}`, 5, 15 * 60_000);
  rateLimit(`login-ip:${request.headers.get("x-forwarded-for") ?? "local"}`, 20, 15 * 60_000);

  const user = await loginWithPassword(input.email, input.password);
  const token = await createSession(user.id, request.headers.get("user-agent"));

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieSet(request, token) } },
  );
}
