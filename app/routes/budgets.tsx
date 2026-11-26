import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator, useSearchParams } from "react-router";
import type { Route } from "./+types/budgets";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { CategoryIcon } from "@/components/features/category-icon";
import { MonthNav } from "@/components/features/month-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiPatch, ApiError } from "@/lib/api";
import { currentMonth, isValidMonthStr } from "@/lib/dates";
import type { BudgetProgressDTO } from "@/lib/types";
import { requireAuth } from "@/server/auth.service";
import { getBudgetProgress } from "@/server/budgets.service";
import { listCategories } from "@/server/categories.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const monthParam = new URL(request.url).searchParams.get("month");
  const month = isValidMonthStr(monthParam) ? monthParam : currentMonth();

  const [progress, categories] = await Promise.all([
    getBudgetProgress(user.id, month),
    listCategories(user.id),
  ]);

  return { progress, categories, month, baseCurrency: user.currency };
}

type BudgetRow = {
  categoryId: string;
  amount: string;
  rollover: boolean;
};

export default function BudgetsPage({ loaderData }: Route.ComponentProps) {
  const { t, fmtMoney } = useI18n();
  const { categories, month, baseCurrency } = loaderData;
  const [, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<BudgetRow[]>(() =>
    loaderData.progress.map((p) => ({
      categoryId: p.categoryId,
      amount: String(p.budgetAmount),
      rollover: p.rollover,
    })),
  );
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    setRows(
      loaderData.progress.map((p) => ({
        categoryId: p.categoryId,
        amount: String(p.budgetAmount),
        rollover: p.rollover,
      })),
    );
  }, [loaderData.progress]);

  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const save = useMutation({
    mutationFn: () =>
      apiPatch("/api/budgets", {
        items: rows.map((r) => ({
          categoryId: r.categoryId,
          amount: Number(r.amount.replace(",", ".")) || 0,
          rollover: r.rollover,
        })),
      }),
    onSuccess: async () => {
      toast.success(t("budgets.saved"));
      await Promise.all([
        queryClient.invalidateQueries(),
        revalidator.revalidate(),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("budgets.saveFailed")),
  });

  function onMonthChange(next: string) {
    setSearchParams(next === currentMonth() ? {} : { month: next }, { replace: true });
  }

  const progressByCategory = new Map(loaderData.progress.map((p) => [p.categoryId, p]));
  const budgetedIds = new Set(rows.map((r) => r.categoryId));
  const unbudgeted = categories.filter(
    (c) => c.kind === "expense" && !budgetedIds.has(c.id),
  );

  const totalBudget = rows.reduce(
    (sum, r) => sum + (Number(r.amount.replace(",", ".")) || 0),
    0,
  );
  const totalSpent = loaderData.progress.reduce((sum, p) => sum + p.spent, 0);
  const remaining = totalBudget - totalSpent;

  function updateRow(categoryId: string, patch: Partial<BudgetRow>) {
    setRows((prev) =>
      prev.map((r) => (r.categoryId === categoryId ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(categoryId: string) {
    setRows((prev) => prev.filter((r) => r.categoryId !== categoryId));
  }

  function addBudget(categoryId: string) {
    if (!categoryId) return;
    setRows((prev) => [...prev, { categoryId, amount: "", rollover: false }]);
    setAdding(false);
    setNewCategory("");
  }

  return (
    <div className="mx-auto grid max-w-[900px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("budgets.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("budgets.subtitle")}
            {loaderData.progress.some((p) => p.rollover) ? ` · ${t("budgets.rolloverNote")}` : ""}
          </p>
        </div>
        <MonthNav month={month} onChange={onMonthChange} future />
      </header>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("budgets.totalBudget")}
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              {fmtMoney(totalBudget, baseCurrency)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("budgets.spentThisMonth")}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-expense">
              {fmtMoney(totalSpent, baseCurrency)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("budgets.remaining")}
            </span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                remaining < 0 ? "text-expense" : "text-income"
              }`}
            >
              {fmtMoney(remaining, baseCurrency)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Budget rows */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {rows.length === 0 && (
            <li className="grid h-40 place-items-center text-center">
              <div>
                <p className="font-medium">{t("budgets.emptyTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("budgets.emptyBody")}</p>
              </div>
            </li>
          )}
          {rows.map((row) => {
            const category = categories.find((c) => c.id === row.categoryId);
            const p = progressByCategory.get(row.categoryId);
            const allowance = row.amount
              ? Number(row.amount.replace(",", ".")) + (row.rollover ? rolloverOf(p) : 0)
              : (p?.allowance ?? 0);
            const spent = p?.spent ?? 0;
            const pct = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 0;
            const over = allowance > 0 && spent > allowance;
            const categoryName = category?.name ?? t("budgets.categoryFallback");

            return (
              <li key={row.categoryId} className="flex flex-wrap items-center gap-3 p-3">
                <CategoryIcon icon={category?.icon} color={category?.color} />
                <div className="min-w-32 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{categoryName}</span>
                    {row.rollover && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {t("budgets.rollover")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 grid gap-1">
                    <Progress
                      value={pct}
                      className={over ? "bg-muted [&>div]:bg-expense" : undefined}
                    />
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {fmtMoney(spent, baseCurrency)} {t("common.of")}{" "}
                      {fmtMoney(allowance, baseCurrency)}
                      {over ? ` · ${t("budgets.overBudget")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only">{t("budgets.rolloverAria")}</span>
                    <Switch
                      checked={row.rollover}
                      onCheckedChange={(v) => updateRow(row.categoryId, { rollover: v })}
                      aria-label={t("budgets.rollover")}
                    />
                  </label>
                  <Input
                    className="h-9 w-28 text-right tabular-nums"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={row.amount}
                    onChange={(e) => updateRow(row.categoryId, { amount: e.target.value })}
                    aria-label={t("budgets.monthlyBudgetAria", { name: categoryName })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRow(row.categoryId)}
                    aria-label={t("budgets.removeAria", { name: categoryName })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {adding ? (
            <Select value={newCategory} onValueChange={(v) => setNewCategory(v)}>
              <SelectTrigger className="w-56" aria-label={t("common.category")}>
                <SelectValue placeholder={t("budgets.chooseCategory")} />
              </SelectTrigger>
              <SelectContent>
                {unbudgeted.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAdding(true)}
              disabled={unbudgeted.length === 0}
            >
              <Plus className="size-4" aria-hidden />
              {t("budgets.addBudget")}
            </Button>
          )}
          {adding && (
            <>
              <Button size="sm" disabled={!newCategory} onClick={() => addBudget(newCategory)}>
                {t("common.add")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                {t("common.cancel")}
              </Button>
            </>
          )}
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("budgets.save")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("budgets.footnote")}</p>
    </div>
  );
}

function rolloverOf(p: BudgetProgressDTO | undefined): number {
  if (!p) return 0;
  return Math.max(0, p.allowance - p.spent);
}
