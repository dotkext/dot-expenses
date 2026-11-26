import type { Route } from "./+types/cron-run";

import { env } from "@/lib/env";
import { refreshRates } from "@/server/exchange.service";
import { runDueRules } from "@/server/recurring.service";

/**
 * External cron trigger for schedulers the operator prefers over the
 * in-process cron (e.g. Kubernetes CronJobs): POST /api/cron/run with
 * `Authorization: Bearer $CRON_SECRET`. Only active when CRON_SECRET is set.
 */
export async function action({ request }: Route.ActionArgs) {
  if (!env.cronSecret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 404 });
  }

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const created = await runDueRules();
  let ratesRefreshed = false;
  try {
    await refreshRates();
    ratesRefreshed = true;
  } catch {
    // non-fatal
  }

  return Response.json({ ok: true, transactionsCreated: created, ratesRefreshed });
}
