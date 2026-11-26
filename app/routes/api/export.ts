import type { Route } from "./+types/export";

import { requireApiUser } from "@/server/http";
import { exportCsv, exportJson } from "@/server/export.service";
import { todayStr } from "@/lib/dates";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireApiUser(request);
  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "json") {
    return new Response(await exportJson(user), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dot-expenses-${todayStr()}.json"`,
      },
    });
  }

  return new Response(await exportCsv(user), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dot-expenses-${todayStr()}.csv"`,
    },
  });
}
