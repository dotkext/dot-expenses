import type { Route } from "./+types/transaction-duplicate";

import { duplicateTransaction } from "@/server/transactions.service";
import { assertSameOrigin, requireApiUser } from "@/server/http";

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const transaction = await duplicateTransaction(user, params.id);
  return Response.json({ transaction }, { status: 201 });
}
