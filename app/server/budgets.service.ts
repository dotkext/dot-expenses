/**
 * Budgets: per-category monthly amounts with optional rollover, and the
 * progress computation for a given month.
 */

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/lib/schema";
import { addMonths, monthRange } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import type { BudgetProgressDTO } from "@/lib/types";
import type { BudgetsInput } from "@/lib/validation";

const convertedSum = sql<string>`sum(${transactions.amount} * coalesce(${transactions.exchangeRate}, '1'))`;

async function spendByCategory(
  userId: string,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ categoryId: transactions.categoryId, total: convertedSum })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    )
    .groupBy(transactions.categoryId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryId) map.set(row.categoryId, toNumber(row.total));
  }
  return map;
}

export async function getBudgetProgress(
  userId: string,
  month: string,
): Promise<BudgetProgressDTO[]> {
  const { start, end, prev } = monthRange(month);
  const prevRange = monthRange(prev);

  const [rows, spend, prevSpend] = await Promise.all([
    db
      .select({ budget: budgets, category: categories })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.userId, userId))
      .orderBy(categories.name),
    spendByCategory(userId, start, end),
    spendByCategory(userId, prevRange.start, prevRange.end),
  ]);

  return rows.map(({ budget, category }) => {
    const budgetAmount = toNumber(budget.amount);
    const spent = spend.get(category.id) ?? 0;
    const prevSpent = prevSpend.get(category.id) ?? 0;
    // Rollover only counts from months with recorded spending — avoids
    // doubling the budget in the first month of use.
    const rollover =
      budget.rollover && prevSpent > 0 ? Math.max(0, budgetAmount - prevSpent) : 0;
    const allowance = budgetAmount + rollover;
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      categoryIcon: category.icon,
      budgetAmount,
      rollover: budget.rollover,
      spent: round2(spent),
      allowance,
      progress: allowance > 0 ? spent / allowance : 0,
    };
  });
}

/** Bulk upsert: zero/negative amounts remove the budget. */
export async function saveBudgets(userId: string, input: BudgetsInput): Promise<void> {
  for (const item of input.items) {
    const owned = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, item.categoryId)))
      .limit(1);
    if (!owned[0]) continue;

    if (item.amount <= 0) {
      await db
        .delete(budgets)
        .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, item.categoryId)));
      continue;
    }

    await db
      .insert(budgets)
      .values({
        userId,
        categoryId: item.categoryId,
        amount: item.amount.toFixed(2),
        rollover: item.rollover,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId],
        set: { amount: item.amount.toFixed(2), rollover: item.rollover, updatedAt: new Date() },
      });
  }
}

/** Total budget vs spend for the month header. */
export async function getBudgetTotals(userId: string, month: string) {
  const progress = await getBudgetProgress(userId, month);
  const budgetTotal = progress.reduce((sum, p) => sum + p.allowance, 0);
  const spentTotal = progress.reduce((sum, p) => sum + p.spent, 0);
  return { budgetTotal: round2(budgetTotal), spentTotal: round2(spentTotal) };
}

export function prevMonthOf(month: string): string {
  return addMonths(month, -1);
}
