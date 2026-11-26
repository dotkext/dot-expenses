import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { ACCOUNT_TYPES } from "./types";

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  /** Null for OAuth-only accounts. */
  passwordHash: text("password_hash"),
  name: varchar("name", { length: 120 }).notNull(),
  /** ISO 4217 code the user reports in (budgets, dashboard totals). */
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  /** UI language: "en" | "es" | "de". */
  locale: varchar("locale", { length: 5 }).notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** SHA-256 hash of the opaque cookie token — the raw token is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: varchar("user_agent", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: varchar("provider", { length: 32 }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerUserId] }),
    index("oauth_accounts_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Money entities                                                      */
/* ------------------------------------------------------------------ */

export type TransactionType = "expense" | "income";

/** Payment methods / sources: bank accounts, cards, cash, wallets. */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    type: varchar("type", { length: 16 }).$type<AccountType>().notNull().default("bank"),
    /** Balance the account started with, in the user's base currency. */
    startingBalance: numeric("starting_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    color: varchar("color", { length: 7 }),
    isDefault: boolean("is_default").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export type CategoryKind = TransactionType;

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    /** Lucide icon name. */
    icon: varchar("icon", { length: 48 }).notNull().default("tag"),
    color: varchar("color", { length: 7 }),
    kind: varchar("kind", { length: 16 }).$type<CategoryKind>().notNull().default("expense"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("categories_user_idx").on(t.userId),
    unique("categories_user_name_kind_unique").on(t.userId, t.name, t.kind),
  ],
);

/** Stores / merchants with learned defaults for quick add. */
export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    defaultCategoryId: uuid("default_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    defaultAccountId: uuid("default_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    usageCount: integer("usage_count").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("merchants_user_idx").on(t.userId),
    unique("merchants_user_name_unique").on(t.userId, t.name),
  ],
);

export type RecurrenceUnit = "day" | "week" | "month" | "year";

/**
 * Recurring rules. When a rule is due it materializes a real transaction and
 * advances `nextRunAt`. `byDay` is a weekday (0=Sun) for weekly rules or a
 * day-of-month (1-31, clamped) for monthly rules.
 */
export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 16 }).$type<TransactionType>().notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    /** Destination account for recurring transfers (null for normal rules). */
    transferToAccountId: uuid("transfer_to_account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    label: varchar("label", { length: 120 }),
    unit: varchar("unit", { length: 8 }).$type<RecurrenceUnit>().notNull().default("month"),
    interval: integer("interval").notNull().default(1),
    byDay: integer("by_day"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    nextRunAt: date("next_run_at", { mode: "string" }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_user_idx").on(t.userId),
    index("recurring_due_idx").on(t.active, t.nextRunAt),
  ],
);

/**
 * Planned (pending) transactions: things the user intends to pay or receive,
 * possibly without a concrete date, optionally split into monthly installments.
 */
export const plannedTransactions = pgTable(
  "planned_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: varchar("type", { length: 16 }).$type<TransactionType>().notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    notes: varchar("notes", { length: 2000 }),
    /** Optional first month ("YYYY-MM"); null means "someday". */
    targetMonth: varchar("target_month", { length: 7 }),
    installments: integer("installments").notNull().default(1),
    completedInstallments: integer("completed_installments").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("planned_user_idx").on(t.userId)],
);

export const transactions = pgTable(  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 16 }).$type<TransactionType>().notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    /**
     * Snapshot: multiplier from this currency to the user's base currency at
     * creation time. Historical reports never drift when rates change.
     */
    exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    date: date("date", { mode: "string" }).notNull(),
    notes: varchar("notes", { length: 2000 }),
    /** Pairs the two legs of an account-to-account transfer. */
    transferGroupId: uuid("transfer_group_id"),
    recurringRuleId: uuid("recurring_rule_id").references(() => recurringRules.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    index("transactions_user_account_idx").on(t.userId, t.accountId),
    index("transactions_rule_idx").on(t.recurringRuleId),
  ],
);

/** Monthly budget per category. */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    /** Carry over unspent budget from the previous month. */
    rollover: boolean("rollover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("budgets_user_category_unique").on(t.userId, t.categoryId)],
);

/** Dashboard widget grid layout, persisted per user (syncs across devices). */
export const dashboardLayouts = pgTable("dashboard_layouts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layout: jsonb("layout").notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Exchange rates                                                      */
/* ------------------------------------------------------------------ */

/**
 * Cached ECB daily reference rates (EUR-relative, from frankfurter.dev).
 * A cross rate from X to Y is rates[Y] / rates[X].
 */
export const rateCache = pgTable("rate_cache", {
  id: integer("id").primaryKey().default(1),
  /** { "USD": 1.08, ... } — value of 1 EUR in each currency. */
  rates: jsonb("rates").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Manual overrides: 1 unit of `currency` = `rate` in the user's base currency. */
export const rateOverrides = pgTable(
  "rate_overrides",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.currency] })],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  categories: many(categories),
  merchants: many(merchants),
  transactions: many(transactions),
  recurringRules: many(recurringRules),
  budgets: many(budgets),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  merchant: one(merchants, { fields: [transactions.merchantId], references: [merchants.id] }),
  rule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
}));

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
