import type { Route } from "./+types/transaction-detail";

import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/server/transactions.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { transactionInputSchema } from "@/lib/validation";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  return Response.json({ transaction: await getTransaction(user.id, params.id) });
}

export async function action({ request, params }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  switch (request.method) {
    case "PATCH":
    case "PUT": {
      const input = parseBody(transactionInputSchema, await readBody(request));
      const transaction = await updateTransaction(user, params.id, input);
      return Response.json({ transaction });
    }
    case "DELETE": {
      await deleteTransaction(user.id, params.id);
      return Response.json({ ok: true });
    }
    default:
      return new Response(null, { status: 405 });
  }
}
