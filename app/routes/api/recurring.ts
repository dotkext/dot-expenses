import type { Route } from "./+types/recurring";

import { requireApiUser } from "@/server/http";
import { createRule, listRules } from "@/server/recurring.service";
import { assertSameOrigin, parseBody, readBody } from "@/server/http";
import { recurringInputSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json({ rules: await listRules(user) });
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(recurringInputSchema, await readBody(request));
  await createRule(user, input);
  return Response.json({ ok: true }, { status: 201 });
}
