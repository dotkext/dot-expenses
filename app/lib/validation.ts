/**
 * Zod schemas shared between server API routes and client forms.
 *
 * Validation messages are translation keys (app/lib/i18n) so the UI can
 * render them in the active language and API responses can be localized by
 * the fetch layer on the client.
 */

import { z } from "zod";

import { CURRENCY_CODES } from "./currencies";
import { DEFAULT_LOCALE, LOCALES } from "./i18n/core";
import { ACCOUNT_TYPES } from "./types";

export const currencyCode = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase())
  .refine((v) => CURRENCY_CODES.includes(v), { message: "errors.unsupportedCurrency" });

/** Accepts any ISO code (manual overrides may exist for exotic currencies). */
export const anyCurrencyCode = z
  .string()
  .trim()
  .length(3)
  .transform((v) => v.toUpperCase());

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate");

export const localeCode = z.enum(LOCALES).default(DEFAULT_LOCALE);

export const moneyAmount = z.coerce
  .number()
  .positive("errors.amountPositive")
  .max(9_999_999_999);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(120),
  email: z.string().trim().toLowerCase().max(255).pipe(z.email("errors.invalidEmail")),
  password: z.string().min(8, "errors.passwordMin").max(128),
  currency: currencyCode,
  locale: localeCode,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(255).pipe(z.email("errors.invalidEmail")),
  password: z.string().min(1, "errors.passwordRequired"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const transactionInputSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: moneyAmount,
  currency: anyCurrencyCode,
  accountId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  merchant: z.string().trim().max(120).nullable(),
  date: dateStr,
  notes: z.string().trim().max(2000).nullable(),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(80),
  type: z.enum(ACCOUNT_TYPES),
  startingBalance: z.coerce.number().min(-9_999_999_999).max(9_999_999_999),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  isDefault: z.boolean().optional(),
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(80),
  icon: z.string().trim().max(48).default("tag"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  kind: z.enum(["expense", "income"]),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const merchantInputSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(120),
  defaultCategoryId: z.string().uuid().nullable().optional(),
  defaultAccountId: z.string().uuid().nullable().optional(),
});
export type MerchantInput = z.infer<typeof merchantInputSchema>;

export const recurringInputSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    amount: moneyAmount,
    currency: anyCurrencyCode,
    accountId: z.string().uuid().nullable(),
    transferToAccountId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable(),
    merchant: z.string().trim().max(120).nullable(),
    label: z.string().trim().max(120).nullable(),
    unit: z.enum(["day", "week", "month", "year"]),
    interval: z.coerce.number().int().min(1, "errors.intervalMin").max(365),
    byDay: z.coerce.number().int().min(0).max(31).nullable(),
    startDate: dateStr,
    endDate: dateStr.nullable(),
    active: z.boolean(),
  })
  .refine((value) => !value.transferToAccountId || value.accountId != null, {
    message: "errors.transferAccountRequired",
    path: ["transferToAccountId"],
  })
  .refine((value) => !value.transferToAccountId || value.transferToAccountId !== value.accountId, {
    message: "errors.transferSameAccount",
    path: ["transferToAccountId"],
  });
export type RecurringInput = z.infer<typeof recurringInputSchema>;

export const plannedInputSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(120),
  type: z.enum(["expense", "income"]),
  amount: moneyAmount,
  categoryId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
  notes: z.string().trim().max(2000).nullable(),
  targetMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "errors.invalidMonth")
    .nullable(),
  installments: z.coerce.number().int().min(1, "errors.intervalMin").max(60),
});
export type PlannedInput = z.infer<typeof plannedInputSchema>;

export const budgetsSchema = z.object({
  items: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        amount: z.coerce.number().min(0).max(9_999_999_999),
        rollover: z.boolean(),
      }),
    )
    .max(200),
});
export type BudgetsInput = z.infer<typeof budgetsSchema>;

export const layoutSchema = z.object({
  layout: z
    .array(
      z.object({
        i: z.string().min(1).max(60),
        x: z.coerce.number().int().min(0).max(11),
        y: z.coerce.number().int().min(0).max(400),
        w: z.coerce.number().int().min(1).max(12),
        h: z.coerce.number().int().min(1).max(40),
      }),
    )
    .max(40),
});
export type LayoutInput = z.infer<typeof layoutSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "errors.nameRequired").max(120),
  email: z.string().trim().toLowerCase().max(255).pipe(z.email("errors.invalidEmail")),
  currency: anyCurrencyCode,
  locale: localeCode,
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "errors.currentPasswordRequired"),
  newPassword: z.string().min(8, "errors.passwordMin").max(128),
});

export const rateOverrideSchema = z.object({
  currency: anyCurrencyCode,
  rate: z.coerce.number().positive("errors.ratePositive").max(1_000_000),
});
