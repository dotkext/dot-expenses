/**
 * Transactions: listing with filters, create (with rate snapshot + merchant
 * learning), update, duplicate, delete.
 */

import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accounts,
  categories,
  merchants,
  recurringRules,
  transactions,
  type User,
} from "@/lib/schema";
import { todayStr } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import type { TransactionDTO, TransactionListResult } from "@/lib/types";
import type { TransactionInput } from "@/lib/validation";

import { assertAccountOwned } from "./accounts.service";
import { assertCategoryOwned } from "./categories.service";
import { requireEffectiveRate } from "./exchange.service";
import { apiError } from "./http";
import { resolveMerchant } from "./merchants.service";

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

const transactionSelection = {
  id: transactions.id,
  type: transactions.type,
  amount: transactions.amount,
  currency: transactions.currency,
  exchangeRate: transactions.exchangeRate,
  date: transactions.date,
  notes: transactions.notes,
  accountId: transactions.accountId,
  accountName: accounts.name,
  accountType: accounts.type,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
  merchantId: transactions.merchantId,
  merchantName: merchants.name,
  recurringRuleId: transactions.recurringRuleId,
};

type TransactionRow = {
  [K in keyof typeof transactionSelection]: unknown;
};

function toDTO(row: Record<string, unknown>): TransactionDTO {
  const amount = toNumber(row.amount as string);
  const rate = row.exchangeRate == null ? 1 : toNumber(row.exchangeRate as string);
  return {
    id: row.id as string,
    type: row.type as TransactionDTO["type"],
    amount,
    currency: row.currency as string,
    amountBase: round2(amount * rate),
    exchangeRate: row.exchangeRate == null ? null : toNumber(row.exchangeRate as string),
    date: row.date as string,
    notes: (row.notes as string | null) ?? null,
    accountId: (row.accountId as string | null) ?? null,
    accountName: (row.accountName as string | null) ?? null,
    accountType: (row.accountType as TransactionDTO["accountType"]) ?? null,
    categoryId: (row.categoryId as string | null) ?? null,
    categoryName: (row.categoryName as string | null) ?? null,
    categoryColor: (row.categoryColor as string | null) ?? null,
    categoryIcon: (row.categoryIcon as string | null) ?? null,
    merchantId: (row.merchantId as string | null) ?? null,
    merchantName: (row.merchantName as string | null) ?? null,
    recurringRuleId: (row.recurringRuleId as string | null) ?? null,
  };
}

function baseQuery() {
  return db
    .select(transactionSelection)
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id));
}

function buildConditions(
  userId: string,
  opts: TransactionFilters,
): SQL[] {
  const conditions: SQL[] = [eq(transactions.userId, userId)];
  if (opts.type) conditions.push(eq(transactions.type, opts.type));
  if (opts.categoryId) conditions.push(eq(transactions.categoryId, opts.categoryId));
  if (opts.accountId) conditions.push(eq(transactions.accountId, opts.accountId));
  if (opts.from) conditions.push(gte(transactions.date, opts.from));
  if (opts.to) conditions.push(lte(transactions.date, opts.to));
  if (opts.q?.trim()) {
    const needle = `%${opts.q.trim()}%`;
    const search = or(
      ilike(transactions.notes, needle),
      ilike(merchants.name, needle),
      ilike(categories.name, needle),
    );
    if (search) conditions.push(search);
  }
  return conditions;
}

export type TransactionFilters = {
  q?: string;
  type?: "expense" | "income";
  categoryId?: string;
  accountId?: string;
  from?: string;
  to?: string;
};

export async function listTransactions(
  userId: string,
  opts: TransactionFilters & { page?: number; pageSize?: number; order?: "date" | "amount" },
): Promise<TransactionListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 25));
  const conditions = buildConditions(userId, opts);

  const order =
    opts.order === "amount"
      ? [desc(transactions.amount), desc(transactions.date)]
      : [desc(transactions.date), desc(transactions.createdAt)];

  const [rows, totals] = await Promise.all([
    baseQuery()
      .where(and(...conditions))
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(transactions)
      .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions)),
  ]);

  return {
    items: (rows as unknown as TransactionRow[]).map((r) => toDTO(r as Record<string, unknown>)),
    total: totals[0]?.value ?? 0,
    page,
    pageSize,
  };
}

export async function getRecentTransactions(userId: string, limit = 8): Promise<TransactionDTO[]> {
  const rows = await baseQuery()
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
  return (rows as unknown as TransactionRow[]).map((r) => toDTO(r as Record<string, unknown>));
}

export async function getTransaction(
  userId: string,
  id: string,
): Promise<TransactionDTO> {
  const rows = await baseQuery()
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .limit(1);
  if (!rows[0]) apiError("errors.transactionNotFound", 404);
  return toDTO(rows[0] as unknown as Record<string, unknown>);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createTransaction(
  user: User,
  input: TransactionInput,
): Promise<TransactionDTO> {
  await assertAccountOwned(user.id, input.accountId);
  await assertCategoryOwned(user.id, input.categoryId, input.type);

  const rate = await requireEffectiveRate(user.id, user.currency, input.currency);
  const merchantId = await resolveMerchant(user.id, input);

  const [row] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      type: input.type,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      exchangeRate: rate.toFixed(8),
      accountId: input.accountId,
      categoryId: input.categoryId,
      merchantId,
      date: input.date,
      notes: input.notes || null,
    })
    .returning({ id: transactions.id });

  return getTransaction(user.id, row.id);
}

export async function updateTransaction(
  user: User,
  id: string,
  input: TransactionInput,
): Promise<TransactionDTO> {
  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), eq(transactions.id, id)))
    .limit(1);
  if (!existing[0]) apiError("errors.transactionNotFound", 404);

  await assertAccountOwned(user.id, input.accountId);
  await assertCategoryOwned(user.id, input.categoryId, input.type);

  const rate = await requireEffectiveRate(user.id, user.currency, input.currency);
  const merchantId = await resolveMerchant(user.id, input);

  await db
    .update(transactions)
    .set({
      type: input.type,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      exchangeRate: rate.toFixed(8),
      accountId: input.accountId,
      categoryId: input.categoryId,
      merchantId,
      date: input.date,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id));

  return getTransaction(user.id, id);
}

export async function duplicateTransaction(user: User, id: string): Promise<TransactionDTO> {
  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), eq(transactions.id, id)))
    .limit(1);
  if (!existing[0]) apiError("errors.transactionNotFound", 404);

  const [row] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      type: existing[0].type,
      amount: existing[0].amount,
      currency: existing[0].currency,
      exchangeRate: existing[0].exchangeRate,
      accountId: existing[0].accountId,
      categoryId: existing[0].categoryId,
      merchantId: existing[0].merchantId,
      date: todayStr(),
      notes: existing[0].notes,
    })
    .returning({ id: transactions.id });

  return getTransaction(user.id, row.id);
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const result = await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning({ id: transactions.id });
  if (!result[0]) apiError("errors.transactionNotFound", 404);
}

/** Fetch the recurring rule a transaction came from (for the edit dialog). */
export async function getRecurringRuleOf(userId: string, ruleId: string) {
  const rows = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.id, ruleId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Simple existence check used by quick add's "undo". */
export async function transactionExists(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .limit(1);
  return Boolean(rows[0]);
}

/** Oldest → newest, used by the CSV export. */
export async function getAllTransactions(userId: string): Promise<TransactionDTO[]> {
  const rows = await baseQuery()
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.date), asc(transactions.createdAt));
  return (rows as unknown as TransactionRow[]).map((r) => toDTO(r as Record<string, unknown>));
}
