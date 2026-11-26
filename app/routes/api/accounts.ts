import type { Route } from "./+types/accounts";

import { createAccount, listAccounts } from "@/server/accounts.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { accountInputSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json(await listAccounts(user.id));
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(accountInputSchema, await readBody(request));
  await createAccount(user.id, input);
  return Response.json({ ok: true }, { status: 201 });
}
