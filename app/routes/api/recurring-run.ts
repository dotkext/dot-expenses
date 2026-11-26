import type { Route } from "./+types/recurring-run";

import { runRuleNow } from "@/server/recurring.service";
import { assertSameOrigin, requireApiUser } from "@/server/http";

/** Force-run the next occurrence of a rule immediately. */
export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  await runRuleNow(user, params.id);
  return Response.json({ ok: true });
}
