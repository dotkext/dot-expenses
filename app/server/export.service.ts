/**
 * Data export: CSV and JSON of the user's full dataset.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accounts as accountsTable,
  budgets,
  categories as categoriesTable,
  dashboardLayouts,
  merchants,
  rateOverrides,
  recurringRules,
  transactions as transactionsTable,
  type User,
} from "@/lib/schema";

import { seedUserDefaults } from "./auth.service";
import { getAllTransactions } from "./transactions.service";

function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function exportCsv(user: User): Promise<string> {
  const transactions = await getAllTransactions(user.id);
  const header = [
    "date",
    "type",
    "amount",
    "currency",
    "amount_base",
    "base_currency",
    "category",
    "account",
    "merchant",
    "notes",
    "recurring",
  ].join(",");

  const lines = transactions.map((t) =>
    [
      t.date,
      t.type,
      t.amount.toFixed(2),
      t.currency,
      t.amountBase.toFixed(2),
      user.currency,
      t.categoryName,
      t.accountName,
      t.merchantName,
      t.notes,
      t.recurringRuleId != null ? "yes" : "no",
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header, ...lines].join("\r\n");
}

export async function exportJson(user: User): Promise<string> {
  const [accountsRows, categoriesRows, merchantsRows, budgetsRows, rulesRows, transactionsRows] =
    await Promise.all([
      db.select().from(accountsTable).where(eq(accountsTable.userId, user.id)),
      db.select().from(categoriesTable).where(eq(categoriesTable.userId, user.id)),
      db.select().from(merchants).where(eq(merchants.userId, user.id)),
      db.select().from(budgets).where(eq(budgets.userId, user.id)),
      db.select().from(recurringRules).where(eq(recurringRules.userId, user.id)),
      getAllTransactions(user.id),
    ]);

  const redact = <T extends { userId?: string }>(rows: T[]): Omit<T, "userId">[] =>
    rows.map(({ userId: _userId, ...rest }) => rest);

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      user: { email: user.email, name: user.name, currency: user.currency },
      accounts: redact(accountsRows),
      categories: redact(categoriesRows),
      merchants: redact(merchantsRows),
      budgets: redact(budgetsRows),
      recurringRules: redact(rulesRows),
      transactions: transactionsRows.map((t) => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        amountBase: t.amountBase,
        category: t.categoryName,
        account: t.accountName,
        merchant: t.merchantName,
        notes: t.notes,
        recurring: t.recurringRuleId != null,
      })),
    },
    null,
    2,
  );
}

/** Delete all financial data (keeps the account itself, restores defaults). */
export async function deleteAllData(user: User): Promise<void> {
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, user.id));
  await db.delete(recurringRules).where(eq(recurringRules.userId, user.id));
  await db.delete(budgets).where(eq(budgets.userId, user.id));
  await db.delete(merchants).where(eq(merchants.userId, user.id));
  await db.delete(categoriesTable).where(eq(categoriesTable.userId, user.id));
  await db.delete(accountsTable).where(eq(accountsTable.userId, user.id));
  await db.delete(dashboardLayouts).where(eq(dashboardLayouts.userId, user.id));
  await db.delete(rateOverrides).where(eq(rateOverrides.userId, user.id));

  await seedUserDefaults(user.id);
}
