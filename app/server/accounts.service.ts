/**
 * Accounts (payment methods) CRUD with computed balances.
 */

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/schema";
import { round2, toNumber } from "@/lib/money";
import type { AccountDTO } from "@/lib/types";
import type { AccountInput } from "@/lib/validation";

import { apiError } from "./http";

/**
 * Current balance = starting balance + all converted income - all converted
 * expenses on the account (converted to the user's base currency).
 */
export async function listAccounts(userId: string): Promise<AccountDTO[]> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      startingBalance: accounts.startingBalance,
      color: accounts.color,
      isDefault: accounts.isDefault,
      balance: sql<string>`
        ${accounts.startingBalance}
        + coalesce(sum(${transactions.amount} * coalesce(${transactions.exchangeRate}, '1'))
          filter (where ${transactions.type} = 'income'), 0)
        - coalesce(sum(${transactions.amount} * coalesce(${transactions.exchangeRate}, '1'))
          filter (where ${transactions.type} = 'expense'), 0)
      `,
      transactionCount: sql<number>`count(${transactions.id})::int`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(accounts.createdAt);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    startingBalance: toNumber(row.startingBalance),
    color: row.color,
    isDefault: row.isDefault,
    balance: round2(toNumber(row.balance)),
    transactionCount: row.transactionCount,
  }));
}

export async function createAccount(userId: string, input: AccountInput): Promise<void> {
  if (input.isDefault) await clearDefault(userId);
  await db.insert(accounts).values({
    userId,
    name: input.name,
    type: input.type,
    startingBalance: input.startingBalance.toFixed(2),
    color: input.color ?? null,
    isDefault: input.isDefault ?? false,
  });
}

export async function updateAccount(
  userId: string,
  id: string,
  input: AccountInput,
): Promise<void> {
  if (input.isDefault) await clearDefault(userId);
  const result = await db
    .update(accounts)
    .set({
      name: input.name,
      type: input.type,
      startingBalance: input.startingBalance.toFixed(2),
      color: input.color ?? null,
      isDefault: input.isDefault ?? false,
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .returning({ id: accounts.id });
  if (!result[0]) apiError("errors.accountNotFound", 404);
}

async function clearDefault(userId: string): Promise<void> {
  await db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, userId));
}

/**
 * Delete an account. When it still has transactions, they must be moved to
 * another account first (`moveTo`), or deleted with the account (`cascade`).
 */
export async function deleteAccount(
  userId: string,
  id: string,
  opts: { moveTo?: string | null; cascade?: boolean },
): Promise<void> {
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .limit(1);
  if (!owned[0]) apiError("errors.accountNotFound", 404);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.accountId, id)));

  if (count > 0 && !opts.moveTo && !opts.cascade) {
    apiError("errors.accountHasTransactions", 409, { count });
  }

  if (opts.moveTo) {
    const target = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, opts.moveTo)))
      .limit(1);
    if (!target[0]) apiError("errors.targetAccountNotFound", 404);
    await db
      .update(transactions)
      .set({ accountId: opts.moveTo })
      .where(and(eq(transactions.userId, userId), eq(transactions.accountId, id)));
  }

  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, id)));
}

/** Assert an account belongs to the user. */
export async function assertAccountOwned(userId: string, id: string | null): Promise<void> {
  if (!id) return;
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .limit(1);
  if (!rows[0]) apiError("errors.accountNotFound", 404);
}
