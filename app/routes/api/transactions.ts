import type { Route } from "./+types/transactions";

import { createTransaction, listTransactions } from "@/server/transactions.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { isValidDateStr } from "@/lib/dates";
import { transactionInputSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const url = new URL(request.url);

  const type = url.searchParams.get("type");
  const page = Number(url.searchParams.get("page") ?? "1");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const result = await listTransactions(user.id, {
    q: url.searchParams.get("q") ?? undefined,
    type: type === "expense" || type === "income" ? type : undefined,
    categoryId: url.searchParams.get("categoryId") || undefined,
    accountId: url.searchParams.get("accountId") || undefined,
    from: isValidDateStr(from) ? from : undefined,
    to: isValidDateStr(to) ? to : undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: 25,
  });

  return Response.json(result);
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(transactionInputSchema, await readBody(request));
  const transaction = await createTransaction(user, input);

  return Response.json({ transaction }, { status: 201 });
}
