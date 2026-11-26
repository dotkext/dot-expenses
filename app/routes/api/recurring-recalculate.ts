import type { Route } from "./+types/recurring-recalculate";

import { assertSameOrigin, requireApiUser } from "@/server/http";
import { recalculateAllRules } from "@/server/recurring.service";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const count = await recalculateAllRules(user);
  return Response.json({ ok: true, count });
}
