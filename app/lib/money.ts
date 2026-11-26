/**
 * Money formatting helpers. Amounts travel as strings through the API
 * (Postgres numeric) and are converted to numbers only for display math.
 *
 * A fixed locale keeps SSR output and client hydration identical.
 */

export const FORMAT_LOCALE = "en-US";

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number.parseFloat(value) || 0;
}

/** Round to 2 decimals, avoiding most float artifacts (e.g. 0.1 + 0.2). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency: string, signed = false): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(FORMAT_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (!signed) return amount < 0 ? `-${formatted}` : formatted;
  return `${amount < 0 ? "-" : "+"}${formatted}`;
}

export function formatMoneyCompact(amount: number, currency: string): string {
  return new Intl.NumberFormat(FORMAT_LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatAmount(amount: number, currency: string): string {
  return `${new Intl.NumberFormat(FORMAT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
