import type { Route } from "./+types/planned";

import { plannedInputSchema } from "@/lib/validation";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { createPlanned, listPlanned } from "@/server/planned.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json(await listPlanned(user));
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(plannedInputSchema, await readBody(request));
  await createPlanned(user, input);
  return Response.json({ ok: true }, { status: 201 });
}
