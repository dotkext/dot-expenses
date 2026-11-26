import type { Route } from "./+types/dashboard-summary";

import { getDashboardSummary } from "@/server/dashboard.service";
import { requireApiUser } from "@/server/http";
import { currentMonth, isValidMonthStr } from "@/lib/dates";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const month = new URL(request.url).searchParams.get("month");
  const summary = await getDashboardSummary(user, isValidMonthStr(month) ? month : currentMonth());
  return Response.json(summary);
}
