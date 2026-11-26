import type { Route } from "./+types/budgets";

import { getBudgetProgress, saveBudgets } from "@/server/budgets.service";
import { assertSameOrigin, parseBody, readBody, requireApiUser } from "@/server/http";
import { isValidMonthStr, currentMonth } from "@/lib/dates";
import { budgetsSchema } from "@/lib/validation";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const month = new URL(request.url).searchParams.get("month");
  return Response.json({
    budgets: await getBudgetProgress(user.id, isValidMonthStr(month) ? month : currentMonth()),
  });
}

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const user = await requireApiUser(request);

  const input = parseBody(budgetsSchema, await readBody(request));
  await saveBudgets(user.id, input);
  return Response.json({ ok: true });
}
