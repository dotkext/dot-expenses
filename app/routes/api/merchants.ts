import type { Route } from "./+types/merchants";

import { merchantInputSchema } from "@/lib/validation";
import { apiError, assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { createMerchant, listMerchants } from "@/server/merchants.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  return Response.json(await listMerchants(user.id, q));
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  if (request.method !== "POST") apiError("errors.methodNotAllowed", 405);

  const input = parseBody(merchantInputSchema, await readBody(request));
  const merchant = await createMerchant(user.id, input);
  return Response.json(merchant, { status: 201 });
}
