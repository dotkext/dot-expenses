/**
 * Merchants (stores) with learned defaults for quick add.
 */

import { and, desc, eq, ilike, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, categories, merchants } from "@/lib/schema";
import type { MerchantDTO } from "@/lib/types";
import type { MerchantInput, TransactionInput } from "@/lib/validation";

import { apiError } from "./http";

function toDTO(row: {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  defaultAccountId: string | null;
  defaultCategoryName: string | null;
  usageCount: number;
}): MerchantDTO {
  return {
    id: row.id,
    name: row.name,
    defaultCategoryId: row.defaultCategoryId,
    defaultAccountId: row.defaultAccountId,
    defaultCategoryName: row.defaultCategoryName,
    usageCount: row.usageCount,
  };
}

export async function listMerchants(userId: string, q?: string): Promise<MerchantDTO[]> {
  const conditions = [eq(merchants.userId, userId)];
  if (q?.trim()) conditions.push(ilike(merchants.name, `%${q.trim()}%`));

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      defaultCategoryId: merchants.defaultCategoryId,
      defaultAccountId: merchants.defaultAccountId,
      defaultCategoryName: categories.name,
      usageCount: merchants.usageCount,
    })
    .from(merchants)
    .leftJoin(categories, eq(merchants.defaultCategoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(merchants.usageCount), desc(merchants.lastUsedAt))
    .limit(100);

  return rows.map(toDTO);
}

/**
 * Find or create a merchant by (case-insensitive) name and record the
 * category/account used with it, so quick add can pre-fill them next time.
 */
export async function resolveMerchant(
  userId: string,
  input: TransactionInput | { merchant: string | null; categoryId: string | null; accountId: string | null },
): Promise<string | null> {
  const name = input.merchant?.trim();
  if (!name) return null;

  const existing = await db
    .select()
    .from(merchants)
    .where(and(eq(merchants.userId, userId), sql`lower(${merchants.name}) = lower(${name})`))
    .limit(1);

  if (existing[0]) {
    await db
      .update(merchants)
      .set({
        defaultCategoryId: input.categoryId ?? existing[0].defaultCategoryId,
        defaultAccountId: input.accountId ?? existing[0].defaultAccountId,
        usageCount: existing[0].usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(merchants.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db
    .insert(merchants)
    .values({
      userId,
      name,
      defaultCategoryId: input.categoryId ?? null,
      defaultAccountId: input.accountId ?? null,
    })
    .returning();
  return created.id;
}

/** Called when a transaction is edited, to keep merchant defaults fresh. */
async function touchMerchantDefaults(
  merchantId: string,
  categoryId: string | null,
  accountId: string | null,
): Promise<void> {
  await db
    .update(merchants)
    .set({ defaultCategoryId: categoryId, defaultAccountId: accountId })
    .where(eq(merchants.id, merchantId));
}

export { touchMerchantDefaults };

export async function deleteMerchant(userId: string, id: string): Promise<void> {
  const result = await db
    .delete(merchants)
    .where(and(eq(merchants.userId, userId), eq(merchants.id, id)))
    .returning({ id: merchants.id });
  if (!result[0]) apiError("errors.merchantNotFound", 404);
}

/** Ensure referenced defaults belong to the user. */
async function assertDefaultsOwned(
  userId: string,
  input: { defaultCategoryId?: string | null; defaultAccountId?: string | null },
): Promise<void> {
  if (input.defaultCategoryId) {
    const owned = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, input.defaultCategoryId)))
      .limit(1);
    if (!owned[0]) apiError("errors.categoryNotFound", 404);
  }
  if (input.defaultAccountId) {
    const owned = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, input.defaultAccountId)))
      .limit(1);
    if (!owned[0]) apiError("errors.accountNotFound", 404);
  }
}

/** Create a store up-front instead of waiting to learn it from a transaction. */
export async function createMerchant(userId: string, input: MerchantInput): Promise<MerchantDTO> {
  const name = input.name.trim();

  const duplicate = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(and(eq(merchants.userId, userId), sql`lower(${merchants.name}) = lower(${name})`))
    .limit(1);
  if (duplicate[0]) apiError("errors.merchantExists", 409);

  await assertDefaultsOwned(userId, input);

  const [created] = await db
    .insert(merchants)
    .values({
      userId,
      name,
      defaultCategoryId: input.defaultCategoryId ?? null,
      defaultAccountId: input.defaultAccountId ?? null,
      usageCount: 0,
    })
    .returning();

  let defaultCategoryName: string | null = null;
  if (created.defaultCategoryId) {
    const [category] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, created.defaultCategoryId))
      .limit(1);
    defaultCategoryName = category?.name ?? null;
  }

  return toDTO({
    id: created.id,
    name: created.name,
    defaultCategoryId: created.defaultCategoryId,
    defaultAccountId: created.defaultAccountId,
    defaultCategoryName,
    usageCount: created.usageCount,
  });
}

/** Rename a merchant and optionally set its defaults. */
export async function updateMerchant(
  userId: string,
  id: string,
  input: { name?: string; defaultCategoryId?: string | null; defaultAccountId?: string | null },
): Promise<void> {
  const set: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    const duplicate = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(
        and(
          eq(merchants.userId, userId),
          sql`lower(${merchants.name}) = lower(${name})`,
          ne(merchants.id, id),
        ),
      )
      .limit(1);
    if (duplicate[0]) apiError("errors.merchantExists", 409);
    set.name = name;
  }

  if (input.defaultCategoryId !== undefined) set.defaultCategoryId = input.defaultCategoryId;
  if (input.defaultAccountId !== undefined) set.defaultAccountId = input.defaultAccountId;
  if (Object.keys(set).length === 0) return;

  await assertDefaultsOwned(userId, input);

  const result = await db
    .update(merchants)
    .set(set)
    .where(and(eq(merchants.userId, userId), eq(merchants.id, id)))
    .returning({ id: merchants.id });
  if (!result[0]) apiError("errors.merchantNotFound", 404);
}
