/**
 * Recurring rules: CRUD, virtual projections and the materialization engine
 * that turns due rules into real transactions.
 */

import { randomUUID } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";
import {
  accounts,
  categories,
  merchants,
  recurringRules,
  transactions,
  users,
  type User,
} from "@/lib/schema";
import {
  advanceDate,
  describeFrequency,
  firstOccurrenceOnOrAfter,
  projectOccurrences,
} from "@/lib/frequency";
import { toLocale, getI18n, type Locale } from "@/lib/i18n/core";
import { toDay, todayStr, currentMonth, monthRange } from "@/lib/dates";
import { round2, toNumber } from "@/lib/money";
import type { RecurringRuleDTO, UpcomingOccurrence } from "@/lib/types";
import type { RecurringInput } from "@/lib/validation";

import { assertAccountOwned } from "./accounts.service";
import { assertCategoryOwned } from "./categories.service";
import { effectiveRate, requireEffectiveRate } from "./exchange.service";
import { apiError } from "./http";
import { resolveMerchant } from "./merchants.service";

const MAX_CATCH_UP = 24; // safety cap when a rule is far overdue
const MAX_REBUILD = 400; // safety cap when regenerating a rule's ledger

type RuleRow = typeof recurringRules.$inferSelect;

function ruleDTO(
  row: RuleRow,
  joins: {
    accountName: string | null;
    transferToAccountName: string | null;
    categoryName: string | null;
    merchantName: string | null;
  },
  amountBase: number,
  stats: {
    paidThisMonth: number;
    dueThisMonth: number;
    totalThisMonth: number;
    nextInstallmentAt: string;
  },
): RecurringRuleDTO {
  return {
    id: row.id,
    type: row.type,
    amount: toNumber(row.amount),
    currency: row.currency,
    amountBase,
    ...stats,
    transferToAccountId: row.transferToAccountId,
    transferToAccountName: joins.transferToAccountName,
    isTransfer: row.transferToAccountId != null,
    accountId: row.accountId,
    accountName: joins.accountName,
    categoryId: row.categoryId,
    categoryName: joins.categoryName,
    merchantId: row.merchantId,
    merchantName: joins.merchantName,
    label: row.label,
    unit: row.unit,
    interval: row.interval,
    byDay: row.byDay,
    startDate: row.startDate,
    endDate: row.endDate,
    nextRunAt: row.nextRunAt,
    active: row.active,
  };
}

function labelOf(
  row: RuleRow,
  joins: { merchantName: string | null; categoryName: string | null; transferToAccountName: string | null },
  locale: Locale,
) {
  if (row.transferToAccountId && !row.label) {
    return getI18n(locale).t("recurring.transferTo", {
      account: joins.transferToAccountName ?? "",
    });
  }
  return row.label ?? joins.merchantName ?? joins.categoryName ?? describeFrequency(row, locale);
}

export async function listRules(user: User): Promise<RecurringRuleDTO[]> {
  const transferAccounts = alias(accounts, "transfer_accounts");
  const rows = await db
    .select({
      rule: recurringRules,
      accountName: accounts.name,
      transferToAccountName: transferAccounts.name,
      categoryName: categories.name,
      merchantName: merchants.name,
    })
    .from(recurringRules)
    .leftJoin(accounts, eq(recurringRules.accountId, accounts.id))
    .leftJoin(transferAccounts, eq(recurringRules.transferToAccountId, transferAccounts.id))
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .leftJoin(merchants, eq(recurringRules.merchantId, merchants.id))
    .where(eq(recurringRules.userId, user.id))
    .orderBy(recurringRules.active ? recurringRules.nextRunAt : recurringRules.startDate);

  const month = currentMonth();
  const { start, end } = monthRange(month);
  const today = todayStr();

  // Materialized recurring transactions this month are the "already paid" side.
  const paidRows = await db
    .select({
      ruleId: transactions.recurringRuleId,
      type: transactions.type,
      amount: transactions.amount,
      rate: transactions.exchangeRate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        isNotNull(transactions.recurringRuleId),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ),
    );

  const paidByRule = new Map<string, number>();
  for (const row of paidRows) {
    if (!row.ruleId) continue;
    const base = toNumber(row.amount) * (row.rate == null ? 1 : toNumber(row.rate));
    const key = `${row.ruleId}:${row.type}`;
    paidByRule.set(key, (paidByRule.get(key) ?? 0) + base);
  }

  const result: RecurringRuleDTO[] = [];
  for (const row of rows) {
    const rule = row.rule;
    const rate =
      rule.currency === user.currency
        ? 1
        : await effectiveRate(user.id, user.currency, rule.currency).then((r) => r ?? 1);
    const amountBase = round2(toNumber(rule.amount) * rate);
    // Transfers write two legs; only the outgoing leg counts as "paid".
    const paidType = rule.transferToAccountId ? "expense" : rule.type;
    const paidThisMonth = round2(paidByRule.get(`${rule.id}:${paidType}`) ?? 0);

    // Occurrences still to come this month (including overdue ones that the
    // materializer has not turned into transactions yet).
    let dueDates: string[] = [];
    if (rule.active) {
      const next = firstOccurrenceOnOrAfter(rule, rule.nextRunAt, start);
      if (next <= end) {
        dueDates = projectOccurrences(rule, next, end, 40).filter((date) => date >= start);
      }
    }
    const dueThisMonth = round2(dueDates.length * amountBase);
    const nextInstallmentAt = rule.active
      ? firstOccurrenceOnOrAfter(rule, rule.nextRunAt, today)
      : rule.nextRunAt;

    result.push(
      ruleDTO(
        row.rule,
        {
          accountName: row.accountName,
          transferToAccountName: row.transferToAccountName,
          categoryName: row.categoryName,
          merchantName: row.merchantName,
        },
        amountBase,
        {
          paidThisMonth,
          dueThisMonth,
          totalThisMonth: round2(paidThisMonth + dueThisMonth),
          nextInstallmentAt,
        },
      ),
    );
  }
  return result;
}

export async function createRule(user: User, input: RecurringInput): Promise<void> {
  const isTransfer = input.transferToAccountId != null;
  if (isTransfer) {
    if (input.transferToAccountId === input.accountId) {
      apiError("errors.transferSameAccount", 400);
    }
    await assertAccountOwned(user.id, input.transferToAccountId ?? null);
  }
  await assertAccountOwned(user.id, input.accountId);
  await assertCategoryOwned(user.id, isTransfer ? null : input.categoryId, input.type);
  await requireEffectiveRate(user.id, user.currency, input.currency);

  if (input.endDate && input.endDate < input.startDate) {
    apiError("errors.endDateAfterStart", 400);
  }

  const merchantId = isTransfer ? null : await resolveMerchant(user.id, input);

  await db.insert(recurringRules).values({
    userId: user.id,
    type: input.type,
    amount: input.amount.toFixed(2),
    currency: input.currency,
    accountId: input.accountId,
    transferToAccountId: isTransfer ? input.transferToAccountId : null,
    categoryId: isTransfer ? null : input.categoryId,
    merchantId,
    label: input.label || null,
    unit: input.unit,
    interval: input.interval,
    byDay: input.byDay ?? null,
    startDate: input.startDate,
    endDate: input.endDate || null,
    nextRunAt: firstOccurrenceOnOrAfter(
      { unit: input.unit, interval: input.interval, byDay: input.byDay ?? null },
      input.startDate,
      todayStr(),
    ),
    active: input.active,
  });
}

export async function updateRule(
  user: User,
  id: string,
  input: RecurringInput,
): Promise<void> {
  const existing = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, user.id), eq(recurringRules.id, id)))
    .limit(1);
  if (!existing[0]) apiError("errors.ruleNotFound", 404);

  const isTransfer = input.transferToAccountId != null;
  if (isTransfer) {
    if (input.transferToAccountId === input.accountId) {
      apiError("errors.transferSameAccount", 400);
    }
    await assertAccountOwned(user.id, input.transferToAccountId ?? null);
  }
  await assertAccountOwned(user.id, input.accountId);
  await assertCategoryOwned(user.id, isTransfer ? null : input.categoryId, input.type);
  await requireEffectiveRate(user.id, user.currency, input.currency);

  if (input.endDate && input.endDate < input.startDate) {
    apiError("errors.endDateAfterStart", 400);
  }

  const merchantId = isTransfer ? null : await resolveMerchant(user.id, input);

  // When the cadence or start changes, realign the schedule.
  const cadenceChanged =
    existing[0].unit !== input.unit ||
    existing[0].interval !== input.interval ||
    existing[0].byDay !== (input.byDay ?? null) ||
    existing[0].startDate !== input.startDate ||
    (existing[0].endDate ?? null) !== (input.endDate || null);

  const nextTransferId = isTransfer ? input.transferToAccountId ?? null : null;
  const nextCategoryId = isTransfer ? null : input.categoryId;
  const ledgerChanged =
    cadenceChanged ||
    existing[0].type !== input.type ||
    toNumber(existing[0].amount) !== input.amount ||
    existing[0].currency !== input.currency ||
    existing[0].accountId !== input.accountId ||
    existing[0].transferToAccountId !== nextTransferId ||
    existing[0].categoryId !== nextCategoryId ||
    existing[0].merchantId !== merchantId;

  await db
    .update(recurringRules)
    .set({
      type: input.type,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      accountId: input.accountId,
      transferToAccountId: nextTransferId,
      categoryId: nextCategoryId,
      merchantId,
      label: input.label || null,
      unit: input.unit,
      interval: input.interval,
      byDay: input.byDay ?? null,
      startDate: input.startDate,
      endDate: input.endDate || null,
      nextRunAt: cadenceChanged
        ? firstOccurrenceOnOrAfter(
            { unit: input.unit, interval: input.interval, byDay: input.byDay ?? null },
            input.startDate,
            todayStr(),
          )
        : existing[0].nextRunAt,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(eq(recurringRules.id, id));

  if (ledgerChanged) {
    await rebuildRuleTransactions(id, user);
  }
}

/** Rebuild the transactions of one rule on demand (More → Recalculate). */
export async function recalculateRule(user: User, id: string): Promise<void> {
  const rows = await db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, user.id), eq(recurringRules.id, id)))
    .limit(1);
  if (!rows[0]) apiError("errors.ruleNotFound", 404);
  await rebuildRuleTransactions(id, user);
}

/** Rebuild every rule's generated transactions for this user. */
export async function recalculateAllRules(user: User): Promise<number> {
  const rows = await db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(eq(recurringRules.userId, user.id));
  for (const row of rows) {
    await rebuildRuleTransactions(row.id, user);
  }
  return rows.length;
}

export async function deleteRule(userId: string, id: string): Promise<void> {
  const result = await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.id, id)))
    .returning({ id: recurringRules.id });
  if (!result[0]) apiError("errors.ruleNotFound", 404);
}

export async function setRuleActive(userId: string, id: string, active: boolean): Promise<void> {
  const result = await db
    .update(recurringRules)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.id, id)))
    .returning({ id: recurringRules.id });
  if (!result[0]) apiError("errors.ruleNotFound", 404);
}

/* ------------------------------------------------------------------ */
/* Materialization                                                    */
/* ------------------------------------------------------------------ */

async function materialize(rule: RuleRow, user: User, date: string): Promise<number> {
  const rate = await requireEffectiveRate(rule.userId, user.currency, rule.currency);
  const base = {
    userId: rule.userId,
    type: rule.type,
    amount: rule.amount,
    currency: rule.currency,
    exchangeRate: rate.toFixed(8),
    accountId: rule.accountId,
    categoryId: rule.transferToAccountId ? null : rule.categoryId,
    merchantId: rule.transferToAccountId ? null : rule.merchantId,
    date,
    notes: rule.label ?? null,
    transferGroupId: rule.transferToAccountId ? randomUUID() : null,
    recurringRuleId: rule.id,
  };
  const legs: (typeof transactions.$inferInsert)[] = [base];
  if (rule.transferToAccountId) {
    legs.push({ ...base, type: "income", accountId: rule.transferToAccountId });
  }
  await db.insert(transactions).values(legs);
  return legs.length;
}

/**
 * Replace the ledger entries a rule already created, after its schedule or
 * financial fields changed. Balances are derived from transactions, so
 * removing and recreating the rule's occurrences keeps them consistent.
 */
async function rebuildRuleTransactions(ruleId: string, user: User): Promise<void> {
  const rows = await db
    .select()
    .from(recurringRules)
    .where(eq(recurringRules.id, ruleId))
    .limit(1);
  const rule = rows[0];
  if (!rule) return;

  await db.delete(transactions).where(eq(transactions.recurringRuleId, rule.id));

  const today = todayStr();
  const until = rule.endDate && rule.endDate < today ? rule.endDate : today;
  const dates =
    rule.startDate <= until
      ? projectOccurrences(rule, rule.startDate, until, MAX_REBUILD)
      : [];

  for (const date of dates) {
    await materialize(rule, user, date);
  }

  const last = dates[dates.length - 1];
  const next = last
    ? advanceDate(last, rule)
    : firstOccurrenceOnOrAfter(rule, rule.startDate, today);

  const ended = rule.endDate != null && next > rule.endDate;
  await db
    .update(recurringRules)
    .set({
      nextRunAt: next,
      active: ended ? false : rule.active,
      updatedAt: new Date(),
    })
    .where(eq(recurringRules.id, rule.id));
}

/**
 * Materialize every due occurrence (daily cron + boot catch-up + manual
 * trigger). Returns the number of transactions created.
 */
export async function runDueRules(now = new Date()): Promise<number> {
  const today = toDay(now);

  const due = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.active, true), lte(recurringRules.nextRunAt, today)));

  const userCache = new Map<string, User>();
  let created = 0;

  for (const rule of due) {
    let user = userCache.get(rule.userId);
    if (!user) {
      const rows = await db.select().from(users).where(eq(users.id, rule.userId)).limit(1);
      if (!rows[0]) continue;
      user = rows[0];
      userCache.set(rule.userId, user);
    }

    let next = rule.nextRunAt;
    let runs = 0;
    while (next <= today && runs < MAX_CATCH_UP) {
      if (rule.endDate && next > rule.endDate) break;
      created += await materialize(rule, user, next);
      runs++;
      next = advanceDate(next, rule);
    }

    const ended = rule.endDate != null && next > rule.endDate;
    await db
      .update(recurringRules)
      .set({ nextRunAt: next, active: !ended, updatedAt: new Date() })
      .where(eq(recurringRules.id, rule.id));
  }

  return created;
}

/** Force-run the next occurrence of a rule immediately. */
export async function runRuleNow(user: User, id: string): Promise<void> {
  const rows = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, user.id), eq(recurringRules.id, id)))
    .limit(1);
  const rule = rows[0];
  if (!rule) apiError("errors.ruleNotFound", 404);

  await materialize(rule, user, todayStr());

  // Advance from the scheduled occurrence (not from today) so a monthly rule
  // keeps its day-of-month alignment after a manual run.
  const scheduled = firstOccurrenceOnOrAfter(rule, rule.nextRunAt, todayStr());
  const next = advanceDate(scheduled, rule);
  if (rule.endDate && next > rule.endDate) {
    await db
      .update(recurringRules)
      .set({ nextRunAt: next, active: false, updatedAt: new Date() })
      .where(eq(recurringRules.id, rule.id));
  } else {
    await db
      .update(recurringRules)
      .set({ nextRunAt: next, updatedAt: new Date() })
      .where(eq(recurringRules.id, rule.id));
  }
}

/* ------------------------------------------------------------------ */
/* Projections (virtual, never materialized)                         */
/* ------------------------------------------------------------------ */

export async function getUpcoming(user: User, days = 30): Promise<UpcomingOccurrence[]> {
  const today = todayStr();
  const until = new Date();
  until.setDate(until.getDate() + days);
  const untilStr = toDay(until);
  const transferAccounts = alias(accounts, "transfer_accounts");

  const rows = await db
    .select({
      rule: recurringRules,
      accountName: accounts.name,
      transferToAccountName: transferAccounts.name,
      categoryName: categories.name,
      merchantName: merchants.name,
    })
    .from(recurringRules)
    .leftJoin(accounts, eq(recurringRules.accountId, accounts.id))
    .leftJoin(transferAccounts, eq(recurringRules.transferToAccountId, transferAccounts.id))
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .leftJoin(merchants, eq(recurringRules.merchantId, merchants.id))
    .where(
      and(
        eq(recurringRules.userId, user.id),
        eq(recurringRules.active, true),
        // rules that never end, or whose end date is still in the future
        or(isNull(recurringRules.endDate), gte(recurringRules.endDate, today)),
      ),
    );

  const upcoming: UpcomingOccurrence[] = [];

  for (const row of rows) {
    const { rule } = row;
    // Start from the next occurrence on/after today, skipping any backlog.
    const next = firstOccurrenceOnOrAfter(rule, rule.nextRunAt, today);
    if (rule.endDate && next > rule.endDate) continue;

    const rate =
      rule.currency === user.currency
        ? 1
        : (await effectiveRate(user.id, user.currency, rule.currency)) ?? 1;
    const amountBase = round2(toNumber(rule.amount) * rate);

    for (const date of projectOccurrences(rule, next, untilStr, 12)) {
      if (rule.endDate && date > rule.endDate) break;
      upcoming.push({
        ruleId: rule.id,
        label: labelOf(
          rule,
          {
            merchantName: row.merchantName,
            categoryName: row.categoryName,
            transferToAccountName: row.transferToAccountName,
          },
          toLocale(user.locale),
        ),
        date,
        amount: toNumber(rule.amount),
        currency: rule.currency,
        amountBase,
        type: rule.type,
      });
    }
  }

  return upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 50);
}

