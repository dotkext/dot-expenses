/** Central TanStack Query key registry. */
export const qk = {
  dashboard: (month: string) => ["dashboard", month] as const,
  dashboardLayout: ["dashboard", "layout"] as const,
  transactions: (params: Record<string, string | number | undefined>) =>
    ["transactions", params] as const,
  recurring: ["recurring"] as const,
  budgets: (month: string) => ["budgets", month] as const,
  categories: ["categories"] as const,
  accounts: ["accounts"] as const,
  merchants: (q?: string) => ["merchants", q ?? ""] as const,
  rates: ["rates"] as const,
};
