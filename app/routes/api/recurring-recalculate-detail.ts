import type { Route } from "./+types/recurring-recalculate-detail";

import { assertSameOrigin, requireApiUser } from "@/server/http";
import { recalculateRule } from "@/server/recurring.service";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  await recalculateRule(user, params.id);
  return Response.json({ ok: true });
}
