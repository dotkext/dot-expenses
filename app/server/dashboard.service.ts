/**
 * Dashboard: one aggregated summary for a month (feeds every widget) and the
 * persisted widget grid layout.
 */

import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { dashboardLayouts, transactions, categories, type User } from "@/lib/schema";
import { addMonths, monthRange, daysInMonth } from "@/lib/dates";
import { getI18n, toLocale } from "@/lib/i18n/core";
import { round2, toNumber } from "@/lib/money";
import type { DashboardSummary, WidgetLayoutItem } from "@/lib/types";
import type { AccountType } from "@/lib/schema";

import { listAccounts } from "./accounts.service";
import { getBudgetProgress } from "./budgets.service";
import { getRecentTransactions } from "./transactions.service";
import { getUpcoming } from "./recurring.service";

const convertedSum = sql<string>`sum(${transactions.amount} * coalesce(${transactions.exchangeRate}, '1'))`;

export async function getDashboardSummary(user: User, month: string): Promise<DashboardSummary> {
  const i18n = getI18n(toLocale(user.locale));
  const { start, end, prev } = monthRange(month);
  const prevRange = monthRange(prev);

  const [
    totalsRows,
    prevTotalsRows,
    flowRows,
    categoryRows,
    dailyRows,
    prevDailyRows,
    budgetProgress,
    upcoming,
    accountRows,
    recent,
  ] = await Promise.all([
    // this month's totals
    db
      .select({ type: transactions.type, total: convertedSum })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          isNull(transactions.transferGroupId),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .groupBy(transactions.type),

    // previous month's totals
    db
      .select({ type: transactions.type, total: convertedSum })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          isNull(transactions.transferGroupId),
          gte(transactions.date, prevRange.start),
          lte(transactions.date, prevRange.end),
        ),
      )
      .groupBy(transactions.type),

    // 6-month cash flow
    db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        type: transactions.type,
        total: convertedSum,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          isNull(transactions.transferGroupId),
          gte(transactions.date, monthRange(addMonths(month, -5)).start),
          lte(transactions.date, end),
        ),
      )
      .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, transactions.type),

    // expenses by category this month
    db
      .select({
        categoryId: transactions.categoryId,
        name: categories.name,
        color: categories.color,
        total: convertedSum,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          isNull(transactions.transferGroupId),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .groupBy(transactions.categoryId, categories.name, categories.color),

    // daily totals this month
    db
      .select({ day: transactions.date, type: transactions.type, total: convertedSum })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          isNull(transactions.transferGroupId),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .groupBy(transactions.date, transactions.type),

    // daily totals previous month
    db
      .select({ day: transactions.date, type: transactions.type, total: convertedSum })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          isNull(transactions.transferGroupId),
          gte(transactions.date, prevRange.start),
          lte(transactions.date, prevRange.end),
        ),
      )
      .groupBy(transactions.date, transactions.type),

    getBudgetProgress(user.id, month),
    getUpcoming(user, 30),
    listAccounts(user.id),
    getRecentTransactions(user.id, 8),
  ]);

  /* --- totals --- */
  const income = round2(toNumber(totalsRows.find((r) => r.type === "income")?.total));
  const expense = round2(toNumber(totalsRows.find((r) => r.type === "expense")?.total));
  const prevIncome = round2(toNumber(prevTotalsRows.find((r) => r.type === "income")?.total));
  const prevExpense = round2(toNumber(prevTotalsRows.find((r) => r.type === "expense")?.total));

  /* --- cash flow (last 6 months) --- */
  const flowMap = new Map<string, { income: number; expense: number }>();
  for (const row of flowRows) {
    const entry = flowMap.get(row.month) ?? { income: 0, expense: 0 };
    if (row.type === "income") entry.income = toNumber(row.total);
    else entry.expense = toNumber(row.total);
    flowMap.set(row.month, entry);
  }
  const cashFlow = Array.from({ length: 6 }, (_, i) => {
    const key = addMonths(month, i - 5);
    const entry = flowMap.get(key) ?? { income: 0, expense: 0 };
    return {
      month: key,
      label: i18n.fmtMonthShort(key),
      income: round2(entry.income),
      expense: round2(entry.expense),
      net: round2(entry.income - entry.expense),
    };
  });

  /* --- categories donut --- */
  const categoryTotals = categoryRows
    .map((row) => ({
      categoryId: row.categoryId ?? "none",
      name: row.name ?? i18n.t("common.uncategorized"),
      color: row.color,
      amount: round2(toNumber(row.total)),
    }))
    .sort((a, b) => b.amount - a.amount);
  const categorySum = categoryTotals.reduce((sum, c) => sum + c.amount, 0);
  const categoriesSlice = categoryTotals.slice(0, 8).map((c) => ({
    ...c,
    share: categorySum > 0 ? c.amount / categorySum : 0,
  }));
  if (categoryTotals.length > 8) {
    const restAmount = round2(categorySum - categoriesSlice.reduce((s, c) => s + c.amount, 0));
    categoriesSlice.push({
      categoryId: "other",
      name: i18n.t("dashboard.otherCount", { count: categoryTotals.length - 8 }),
      color: null,
      amount: restAmount,
      share: categorySum > 0 ? restAmount / categorySum : 0,
    });
  }

  /* --- cumulative trend: this vs last month --- */
  const days = daysInMonth(month);
  const daysPrev = daysInMonth(prev);
  const currentCum = new Array<number>(days + 1).fill(0);
  const prevCum = new Array<number>(days + 1).fill(0);
  for (const row of dailyRows) {
    const dayIndex = Number(row.day.slice(8, 10));
    currentCum[dayIndex] = toNumber(row.total);
  }
  for (const row of prevDailyRows) {
    const dayIndex = Number(row.day.slice(8, 10));
    prevCum[dayIndex] = toNumber(row.total);
  }
  for (let i = 1; i <= days; i++) currentCum[i] += currentCum[i - 1];
  for (let i = 1; i <= daysPrev; i++) prevCum[i] += prevCum[i - 1];
  const maxDay = Math.max(days, daysPrev);
  const trend = Array.from({ length: maxDay }, (_, i) => ({
    day: i + 1,
    current: round2(i < days ? currentCum[i + 1] : currentCum[days]),
    previous: round2(i < daysPrev ? prevCum[i + 1] : prevCum[daysPrev]),
  }));

  return {
    month,
    baseCurrency: user.currency,
    totals: {
      income,
      expense,
      net: round2(income - expense),
      savingsRate: income > 0 ? (income - expense) / income : null,
    },
    prevTotals: { income: prevIncome, expense: prevExpense },
    cashFlow,
    categories: categoriesSlice,
    budgets: budgetProgress,
    trend,
    upcoming,
    accounts: accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AccountType,
      color: a.color,
      balance: a.balance,
    })),
    recent,
  };
}

/* ------------------------------------------------------------------ */
/* Widget layout                                                       */
/* ------------------------------------------------------------------ */

export const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { i: "income", x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: "expenses", x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: "net", x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: "savings", x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: "cashflow", x: 0, y: 2, w: 7, h: 6, minW: 4, minH: 4 },
  { i: "categories", x: 7, y: 2, w: 5, h: 6, minW: 3, minH: 4 },
  { i: "trend", x: 0, y: 8, w: 7, h: 6, minW: 4, minH: 4 },
  { i: "budgets", x: 7, y: 8, w: 5, h: 6, minW: 3, minH: 4 },
  { i: "recent", x: 0, y: 14, w: 7, h: 7, minW: 4, minH: 4 },
  { i: "upcoming", x: 7, y: 14, w: 5, h: 7, minW: 3, minH: 4 },
  { i: "accounts", x: 0, y: 21, w: 12, h: 4, minW: 4, minH: 3 },
];

export async function getLayout(userId: string): Promise<WidgetLayoutItem[]> {
  const rows = await db
    .select()
    .from(dashboardLayouts)
    .where(eq(dashboardLayouts.userId, userId))
    .limit(1);
  const layout = rows[0]?.layout;
  return Array.isArray(layout) && layout.length > 0 ? layout : DEFAULT_LAYOUT;
}

export async function saveLayout(userId: string, layout: WidgetLayoutItem[]): Promise<void> {
  await db
    .insert(dashboardLayouts)
    .values({ userId, layout, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: dashboardLayouts.userId,
      set: { layout, updatedAt: new Date() },
    });
}

export async function resetLayout(userId: string): Promise<void> {
  await db.delete(dashboardLayouts).where(eq(dashboardLayouts.userId, userId));
}
