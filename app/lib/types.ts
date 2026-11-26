/**
 * Shared DTOs between server services and client components.
 * Client code must import these with `import type` only — the modules that
 * produce them (app/server/*) are server-only.
 */

import type { AccountType, RecurrenceUnit, TransactionType } from "./schema";
import type { Locale } from "./i18n/core";

export type { AccountType, RecurrenceUnit, TransactionType };

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  currency: string;
  locale: Locale;
  hasPassword: boolean;
  googleLinked: boolean;
};

export type AccountDTO = {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  color: string | null;
  isDefault: boolean;
  balance: number;
  transactionCount: number;
};

export type CategoryDTO = {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  kind: TransactionType;
};

export type MerchantDTO = {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
  defaultCategoryName: string | null;
  usageCount: number;
};

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  /** Amount converted to the user's base currency at the snapshot rate. */
  amountBase: number;
  exchangeRate: number | null;
  date: string;
  notes: string | null;
  accountId: string | null;
  accountName: string | null;
  accountType: AccountType | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  merchantId: string | null;
  merchantName: string | null;
  recurringRuleId: string | null;
};

export type TransactionListResult = {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type RecurringRuleDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  amountBase: number;
  /** Amount already materialized from this rule in the current month (base). */
  paidThisMonth: number;
  /** Amount still scheduled in the current month, not yet materialized (base). */
  dueThisMonth: number;
  /** paidThisMonth + dueThisMonth. */
  totalThisMonth: number;
  /** Next scheduled occurrence on/after today (for display). */
  nextInstallmentAt: string;
  /** Destination account when the rule moves money between accounts. */
  transferToAccountId: string | null;
  transferToAccountName: string | null;
  isTransfer: boolean;
  accountId: string | null;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  merchantId: string | null;
  merchantName: string | null;
  label: string | null;
  unit: RecurrenceUnit;
  interval: number;
  byDay: number | null;
  startDate: string;
  endDate: string | null;
  nextRunAt: string;
  active: boolean;
};

export type UpcomingOccurrence = {
  ruleId: string;
  label: string;
  date: string;
  amount: number;
  currency: string;
  amountBase: number;
  type: TransactionType;
};

export type PlannedTransactionDTO = {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  targetMonth: string | null;
  installments: number;
  completedInstallments: number;
  /** Amount recorded per installment (last one absorbs rounding). */
  installmentAmount: number;
  /** Total not yet recorded. */
  remainingAmount: number;
  /** Next due month ("YYYY-MM") when a target month is set. */
  nextMonth: string | null;
  createdAt: string;
};

export type BudgetProgressDTO = {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  budgetAmount: number;
  rollover: boolean;
  spent: number;
  /** Budget + rollover from the previous month, when enabled. */
  allowance: number;
  progress: number; // 0..1+ spent/allowance
};

export type DashboardSummary = {
  month: string;
  baseCurrency: string;
  totals: { income: number; expense: number; net: number; savingsRate: number | null };
  prevTotals: { income: number; expense: number };
  cashFlow: Array<{ month: string; label: string; income: number; expense: number; net: number }>;
  categories: Array<{
    categoryId: string;
    name: string;
    color: string | null;
    amount: number;
    share: number;
  }>;
  budgets: BudgetProgressDTO[];
  trend: Array<{ day: number; current: number; previous: number }>;
  upcoming: UpcomingOccurrence[];
  accounts: Array<{
    id: string;
    name: string;
    type: AccountType;
    color: string | null;
    balance: number;
  }>;
  recent: TransactionDTO[];
};

/** react-grid-layout item persisted in dashboard_layouts. */
export type WidgetLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export type RateInfo = {
  baseCurrency: string;
  fetchedAt: string | null;
  available: boolean;
  overrides: Array<{ currency: string; rate: number }>;
};

export type ApiOk = { ok: true };

export type RootLoaderData = { googleAuthEnabled: boolean; locale: Locale };

/** Payment method kinds (shared by the schema column type and the UI). */
export const ACCOUNT_TYPES = ["bank", "card", "cash", "wallet", "other"] as const;
