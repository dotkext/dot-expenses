/**
 * Server boot: run migrations, seed exchange rates, start the recurring /
 * rate-refresh cron jobs. Idempotent — safe to call on every boot.
 *
 * Invoked from entry.server.tsx (runs once per server process).
 */

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { schedule } from "node-cron";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { refreshRates } from "./exchange.service";
import { runDueRules } from "./recurring.service";

const globalState = globalThis as unknown as { __dotBootstrapStarted?: boolean };

export function ensureBootstrap(): void {
  if (globalState.__dotBootstrapStarted) return;
  globalState.__dotBootstrapStarted = true;

  void (async () => {
    // 1. Migrations (fail fast — operators should see a clear error)
    if (env.autoMigrate) {
      try {
        await migrate(db, { migrationsFolder: "drizzle" });
        console.log("[dot-expenses] migrations applied");
      } catch (error) {
        console.error("[dot-expenses] migration failed:", error);
        process.exit(1);
      }
    }

    // 2. Exchange rates (non-fatal — overrides still work)
    if (!env.exchangeRatesDisabled) {
      try {
        await refreshRates();
        console.log("[dot-expenses] exchange rates refreshed");
      } catch (error) {
        console.warn("[dot-expenses] exchange rate refresh failed:", (error as Error).message);
      }
    }

    // 3. Catch up on any overdue recurring rules
    try {
      const created = await runDueRules();
      if (created > 0) console.log(`[dot-expenses] recurring engine created ${created} transaction(s)`);
    } catch (error) {
      console.warn("[dot-expenses] recurring catch-up failed:", (error as Error).message);
    }

    // 4. Schedule recurring rules daily at 00:05 + every 6h as a safety net
    schedule("5 0 * * *", () => {
      runDueRules().catch((error) =>
        console.error("[dot-expenses] recurring run failed:", error),
      );
    });
    schedule("15 */6 * * *", () => {
      runDueRules().catch((error) =>
        console.error("[dot-expenses] recurring run failed:", error),
      );
    });

    // 5. Refresh rates twice a day (ECB publishes ~16:00 CET)
    if (!env.exchangeRatesDisabled) {
      schedule("30 5 * * *", () => {
        refreshRates().catch((error) =>
          console.warn("[dot-expenses] rate refresh failed:", error),
        );
      });
      schedule("30 16 * * *", () => {
        refreshRates().catch((error) =>
          console.warn("[dot-expenses] rate refresh failed:", error),
        );
      });
    }

    console.log("[dot-expenses] scheduler started");
  })();
}

// Self-execute on import (entry.server.tsx imports this module once per
// server process).
ensureBootstrap();
