/**
 * Planned (pending) transactions: things the user intends to pay or receive,
 * with an optional target month and optional monthly installments. Recording
 * an installment creates a real transaction and reduces the remaining amount.
 */

import { and, asc, eq, sql } from "drizzle-orm";

import { addMonths, todayStr } from "@/lib/dates";
import { db } from "@/lib/db";
import { round2, toNumber } from "@/lib/money";
import { accounts, categories, plannedTransactions, type User } from "@/lib/schema";
import type { PlannedTransactionDTO } from "@/lib/types";
import type { PlannedInput } from "@/lib/validation";

import { assertAccountOwned } from "./accounts.service";
import { assertCategoryOwned } from "./categories.service";
import { apiError } from "./http";
import { createTransaction } from "./transactions.service";

type PlannedRow = typeof plannedTransactions.$inferSelect;

function toDTO(
  row: PlannedRow,
  joins: {
    categoryName: string | null;
    categoryColor: string | null;
    categoryIcon: string | null;
    accountName: string | null;
  },
): PlannedTransactionDTO {
  const amount = toNumber(row.amount);
  const installmentAmount = round2(amount / row.installments);
  const remainingAmount = round2(amount - installmentAmount * row.completedInstallments);
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amount,
    categoryId: row.categoryId,
    categoryName: joins.categoryName,
    categoryColor: joins.categoryColor,
    categoryIcon: joins.categoryIcon,
    accountId: row.accountId,
    accountName: joins.accountName,
    notes: row.notes,
    targetMonth: row.targetMonth,
    installments: row.installments,
    completedInstallments: row.completedInstallments,
    installmentAmount,
    remainingAmount,
    nextMonth:
      row.targetMonth && row.completedInstallments < row.installments
        ? addMonths(row.targetMonth, row.completedInstallments)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPlanned(user: User): Promise<PlannedTransactionDTO[]> {
  const rows = await db
    .select({
      planned: plannedTransactions,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(plannedTransactions)
    .leftJoin(categories, eq(plannedTransactions.categoryId, categories.id))
    .leftJoin(accounts, eq(plannedTransactions.accountId, accounts.id))
    .where(eq(plannedTransactions.userId, user.id))
    .orderBy(
      sql`${plannedTransactions.targetMonth} asc nulls last`,
      asc(plannedTransactions.createdAt),
    );

  return rows.map((row) =>
    toDTO(row.planned, {
      categoryName: row.categoryName,
      categoryColor: row.categoryColor,
      categoryIcon: row.categoryIcon,
      accountName: row.accountName,
    }),
  );
}

async function validate(user: User, input: PlannedInput): Promise<void> {
  await assertAccountOwned(user.id, input.accountId);
  await assertCategoryOwned(user.id, input.categoryId, input.type);
}

export async function createPlanned(user: User, input: PlannedInput): Promise<void> {
  await validate(user, input);
  await db.insert(plannedTransactions).values({
    userId: user.id,
    name: input.name,
    type: input.type,
    amount: input.amount.toFixed(2),
    categoryId: input.categoryId,
    accountId: input.accountId,
    notes: input.notes || null,
    targetMonth: input.targetMonth,
    installments: input.installments,
  });
}

export async function updatePlanned(
  user: User,
  id: string,
  input: PlannedInput,
): Promise<void> {
  const existing = await db
    .select()
    .from(plannedTransactions)
    .where(and(eq(plannedTransactions.userId, user.id), eq(plannedTransactions.id, id)))
    .limit(1);
  if (!existing[0]) apiError("errors.plannedNotFound", 404);

  await validate(user, input);

  // Never leave the plan already "complete" after reducing the installment
  // count: keep one installment open.
  const completedInstallments = Math.min(
    existing[0].completedInstallments,
    input.installments - 1,
  );

  await db
    .update(plannedTransactions)
    .set({
      name: input.name,
      type: input.type,
      amount: input.amount.toFixed(2),
      categoryId: input.categoryId,
      accountId: input.accountId,
      notes: input.notes || null,
      targetMonth: input.targetMonth,
      installments: input.installments,
      completedInstallments,
      updatedAt: new Date(),
    })
    .where(and(eq(plannedTransactions.userId, user.id), eq(plannedTransactions.id, id)));
}

export async function deletePlanned(userId: string, id: string): Promise<void> {
  const result = await db
    .delete(plannedTransactions)
    .where(and(eq(plannedTransactions.userId, userId), eq(plannedTransactions.id, id)))
    .returning({ id: plannedTransactions.id });
  if (!result[0]) apiError("errors.plannedNotFound", 404);
}

/** Record the next installment as a real transaction. */
export async function recordPlannedInstallment(
  user: User,
  id: string,
): Promise<{ done: boolean; amount: number }> {
  const rows = await db
    .select()
    .from(plannedTransactions)
    .where(and(eq(plannedTransactions.userId, user.id), eq(plannedTransactions.id, id)))
    .limit(1);
  const plan = rows[0];
  if (!plan) apiError("errors.plannedNotFound", 404);
  if (plan.completedInstallments >= plan.installments) {
    apiError("errors.plannedNotFound", 404);
  }

  const total = toNumber(plan.amount);
  const per = round2(total / plan.installments);
  const nextCount = plan.completedInstallments + 1;
  const isLast = nextCount >= plan.installments;
  const amount = isLast ? round2(total - per * plan.completedInstallments) : per;

  const notes = plan.notes ? `${plan.name} — ${plan.notes}` : plan.name;
  await createTransaction(user, {
    type: plan.type,
    amount,
    currency: user.currency,
    accountId: plan.accountId,
    categoryId: plan.categoryId,
    merchant: null,
    date: todayStr(),
    notes,
  });

  if (isLast) {
    await db.delete(plannedTransactions).where(eq(plannedTransactions.id, plan.id));
  } else {
    await db
      .update(plannedTransactions)
      .set({ completedInstallments: nextCount, updatedAt: new Date() })
      .where(eq(plannedTransactions.id, plan.id));
  }

  return { done: isLast, amount };
}
