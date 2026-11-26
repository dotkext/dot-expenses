/**
 * Categories CRUD.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { categories } from "@/lib/schema";
import type { CategoryDTO } from "@/lib/types";
import type { CategoryInput } from "@/lib/validation";

import { apiError } from "./http";

function toDTO(row: typeof categories.$inferSelect): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    kind: row.kind,
  };
}

export async function listCategories(userId: string): Promise<CategoryDTO[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.kind, categories.name);
  return rows.map(toDTO);
}

export async function createCategory(
  userId: string,
  input: CategoryInput,
): Promise<CategoryDTO> {
  const dupe = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.kind, input.kind),
        // case-insensitive via the unique index expression
        eq(categories.name, input.name),
      ),
    )
    .limit(1);
  if (dupe[0]) apiError("errors.categoryExists", 409);

  const [row] = await db
    .insert(categories)
    .values({ userId, ...input })
    .returning();
  return toDTO(row);
}

export async function updateCategory(
  userId: string,
  id: string,
  input: CategoryInput,
): Promise<CategoryDTO> {
  const [row] = await db
    .update(categories)
    .set({ name: input.name, icon: input.icon, color: input.color ?? null, kind: input.kind })
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning();
  if (!row) apiError("errors.categoryNotFound", 404);
  return toDTO(row);
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  // budget rows cascade on category delete; transactions keep category_id=null
  const result = await db
    .delete(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning({ id: categories.id });
  if (!result[0]) apiError("errors.categoryNotFound", 404);
}

/** Assert a category belongs to the user, returning its kind. */
export async function assertCategoryOwned(
  userId: string,
  id: string | null,
  expectKind?: "expense" | "income",
): Promise<"expense" | "income" | null> {
  if (!id) return null;
  const rows = await db
    .select({ kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .limit(1);
  if (!rows[0]) apiError("errors.categoryNotFound", 404);
  if (expectKind && rows[0].kind !== expectKind) {
    apiError(
      rows[0].kind === "expense" ? "errors.categoryKindExpense" : "errors.categoryKindIncome",
      400,
    );
  }
  return rows[0].kind;
}
