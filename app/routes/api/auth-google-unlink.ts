import type { Route } from "./+types/auth-google-unlink";

import { unlinkGoogle } from "@/server/auth.service";
import { apiError, assertSameOrigin, requireApiUser } from "@/server/http";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (!user.passwordHash) {
    apiError("errors.setPasswordFirst", 400);
  }

  await unlinkGoogle(user.id);
  return Response.json({ ok: true });
}
