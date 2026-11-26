import type { Route } from "./+types/auth-register";

import {
  createSession,
  rateLimit,
  registerUser,
  sessionCookieSet,
} from "@/server/auth.service";
import { assertSameOrigin, parseBody, readBody } from "@/server/http";
import { registerSchema } from "@/lib/validation";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  rateLimit(`register:${request.headers.get("x-forwarded-for") ?? "local"}`, 5, 60_000);

  const input = parseBody(registerSchema, await readBody(request));
  const user = await registerUser(input);
  const token = await createSession(user.id, request.headers.get("user-agent"));

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieSet(request, token) } },
  );
}
