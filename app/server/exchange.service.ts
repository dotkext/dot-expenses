/**
 * Exchange rates: ECB daily reference rates cached from frankfurter.dev
 * (free, no API key), with per-user manual overrides taking precedence.
 *
 * The cache is EUR-relative: rates[X] = value of 1 EUR in X, so a cross rate
 * from X to Y is rates[Y] / rates[X].
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rateCache, rateOverrides } from "@/lib/schema";
import { env } from "@/lib/env";
import { toNumber } from "@/lib/money";
import type { RateInfo } from "@/lib/types";

import { apiError } from "./http";

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";

export async function refreshRates(): Promise<void> {
  if (env.exchangeRatesDisabled) return;

  const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Frankfurter fetch failed: ${res.status}`);

  const data = (await res.json()) as { rates: Record<string, number> };
  const rates: Record<string, number> = { EUR: 1, ...data.rates };

  await db
    .insert(rateCache)
    .values({ id: 1, rates, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: rateCache.id,
      set: { rates, fetchedAt: new Date() },
    });
}

async function getCachedRates(): Promise<Record<string, number> | null> {
  const rows = await db.select().from(rateCache).where(eq(rateCache.id, 1)).limit(1);
  if (!rows[0]) return null;
  return rows[0].rates as Record<string, number>;
}

/**
 * Rate for 1 unit of `currency` expressed in `base` (the user's currency).
 * Priority: same currency → 1; manual override; cached cross rate.
 * Returns null when no rate is available.
 */
export async function effectiveRate(
  userId: string,
  base: string,
  currency: string,
): Promise<number | null> {
  if (currency === base) return 1;

  const overrides = await db
    .select()
    .from(rateOverrides)
    .where(and(eq(rateOverrides.userId, userId), eq(rateOverrides.currency, currency)))
    .limit(1);
  if (overrides[0]) return toNumber(overrides[0].rate);

  const rates = await getCachedRates();
  if (rates && rates[base] != null && rates[currency] != null) {
    return rates[base] / rates[currency];
  }
  return null;
}

/**
 * Like effectiveRate but throws a user-friendly API error instead of
 * returning null — used when creating transactions and recurring rules.
 */
export async function requireEffectiveRate(
  userId: string,
  base: string,
  currency: string,
): Promise<number> {
  if (currency === base) return 1;
  const rate = await effectiveRate(userId, base, currency);
  if (rate == null) {
    apiError("errors.rateUnavailable", 422, { currency });
  }
  return rate;
}

export async function getRateInfo(userId: string, base: string): Promise<RateInfo> {
  const [cacheRows, overrides] = await Promise.all([
    db.select().from(rateCache).where(eq(rateCache.id, 1)).limit(1),
    db.select().from(rateOverrides).where(eq(rateOverrides.userId, userId)),
  ]);
  const cache = cacheRows[0];
  return {
    baseCurrency: base,
    fetchedAt: cache?.fetchedAt?.toISOString() ?? null,
    available: env.exchangeRatesDisabled ? false : Boolean(cache),
    overrides: overrides
      .map((o) => ({ currency: o.currency, rate: toNumber(o.rate) }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

export async function setRateOverride(
  userId: string,
  currency: string,
  rate: number,
): Promise<void> {
  await db
    .insert(rateOverrides)
    .values({ userId, currency, rate: rate.toFixed(8) })
    .onConflictDoUpdate({
      target: [rateOverrides.userId, rateOverrides.currency],
      set: { rate: rate.toFixed(8) },
    });
}

export async function deleteRateOverride(userId: string, currency: string): Promise<void> {
  await db
    .delete(rateOverrides)
    .where(and(eq(rateOverrides.userId, userId), eq(rateOverrides.currency, currency)));
}
