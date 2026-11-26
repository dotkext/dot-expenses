import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/recurring";
import { CalendarClock, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api";

import {
  emptyRecurringForm,
  RecurringForm,
  useRecurringMutations,
  type RecurringFormValues,
} from "@/components/features/recurring-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { todayStr } from "@/lib/dates";
import { describeFrequency } from "@/lib/frequency";
import type { RecurringRuleDTO } from "@/lib/types";
import { requireAuth } from "@/server/auth.service";
import { getUpcoming, listRules } from "@/server/recurring.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const [rules, upcoming] = await Promise.all([listRules(user), getUpcoming(user, 30)]);
  return { rules, upcoming, baseCurrency: user.currency, today: todayStr() };
}

function toFormValues(rule: RecurringRuleDTO): RecurringFormValues {
  return {
    type: rule.type,
    amount: String(rule.amount),
    currency: rule.currency,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    merchant: rule.merchantName,
    transferToAccountId: rule.transferToAccountId,
    label: rule.label ?? "",
    unit: rule.unit,
    interval: String(rule.interval),
    byDay: rule.byDay == null ? "" : String(rule.byDay),
    startDate: rule.startDate,
    endDate: rule.endDate ?? "",
    active: rule.active,
  };
}

export default function RecurringPage({ loaderData }: Route.ComponentProps) {
  const { t, locale, fmtMoney, fmtDate } = useI18n();
  const { rules, upcoming, baseCurrency, today } = loaderData;
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringFormValues>(() => emptyRecurringForm(baseCurrency));

  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const { create, update } = useRecurringMutations();

  const toggleActive = useMutation({
    mutationFn: (rule: RecurringRuleDTO) => {
      const input = {
        type: rule.type,
        amount: rule.amount,
        currency: rule.currency,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        merchant: rule.merchantName,
        transferToAccountId: rule.transferToAccountId,
        label: rule.label,
        unit: rule.unit,
        interval: rule.interval,
        byDay: rule.byDay,
        startDate: rule.startDate,
        endDate: rule.endDate,
        active: !rule.active,
      };
      return apiPatch(`/api/recurring/${rule.id}`, input);
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const runNow = useMutation({
    mutationFn: (id: string) => apiPost(`/api/recurring/${id}/run`),
    onSuccess: async () => {
      toast.success(t("recurring.runSuccess"));
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/recurring/${id}`),
    onSuccess: async () => {
      setDeletingId(null);
      toast.success(t("recurring.deleted"));
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const recalculate = useMutation({
    mutationFn: (id: string) => apiPost(`/api/recurring/${id}/recalculate`),
    onSuccess: async () => {
      toast.success(t("recurring.recalculated"));
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const recalculateAll = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; count: number }>("/api/recurring/recalculate"),
    onSuccess: async () => {
      toast.success(t("recurring.recalculatedAll"));
      await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const editingRule = rules.find((r) => r.id === editingId) ?? null;

  const monthTotals = useMemo(() => {
    const totals = {
      expense: { total: 0, paid: 0, due: 0 },
      income: { total: 0, paid: 0, due: 0 },
    };
    for (const rule of rules) {
      if (rule.isTransfer) continue;
      const bucket = totals[rule.type];
      bucket.total += rule.totalThisMonth;
      bucket.paid += rule.paidThisMonth;
      bucket.due += rule.dueThisMonth;
    }
    return totals;
  }, [rules]);

  const nextOccurrence = upcoming.find((u) => u.date >= today);
  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("recurring.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("recurring.activeCount", { count: activeCount })} ·{" "}
            {upcoming.length === 1
              ? t("recurring.occurrencesOne", { count: upcoming.length })
              : t("recurring.occurrencesMany", { count: upcoming.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setForm(emptyRecurringForm(baseCurrency));
              setCreating(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t("recurring.new")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("recurring.moreActions")}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => recalculateAll.mutate()}
                disabled={recalculateAll.isPending}
              >
                <RefreshCw className="size-4" aria-hidden /> {t("recurring.recalculateAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("recurring.expensesMonth")}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-expense">
              −{fmtMoney(monthTotals.expense.total, baseCurrency)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("recurring.paidDue", {
                paid: fmtMoney(monthTotals.expense.paid, baseCurrency),
                due: fmtMoney(monthTotals.expense.due, baseCurrency),
              })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("recurring.incomeMonth")}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-income">
              +{fmtMoney(monthTotals.income.total, baseCurrency)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("recurring.paidDue", {
                paid: fmtMoney(monthTotals.income.paid, baseCurrency),
                due: fmtMoney(monthTotals.income.due, baseCurrency),
              })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("recurring.nextOccurrence")}
            </span>
            {nextOccurrence ? (
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{nextOccurrence.label}</span>
                <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                  {fmtDate(nextOccurrence.date)}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("recurring.nothingScheduled")}
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rules list */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {rules.length === 0 && (
          <div className="grid h-40 place-items-center text-center">
            <div>
              <CalendarClock className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">{t("recurring.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("recurring.emptyBody")}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setForm(emptyRecurringForm(baseCurrency));
                  setCreating(true);
                }}
              >
                <Plus className="size-4" aria-hidden /> {t("recurring.addFirst")}
              </Button>
            </div>
          </div>
        )}

        <ul className="divide-y">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={`flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap ${
                rule.active ? "" : "[&>*]:opacity-60"
              }`}
            >
              <Switch
                checked={rule.active}
                onCheckedChange={() => toggleActive.mutate(rule)}
                aria-label={rule.active ? t("recurring.pauseRule") : t("recurring.resumeRule")}
                disabled={toggleActive.isPending}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {rule.label ??
                      (rule.isTransfer
                        ? t("recurring.transferTo", {
                            account: rule.transferToAccountName ?? "",
                          })
                        : rule.merchantName ?? rule.categoryName ?? t("recurring.fallback"))}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {describeFrequency(rule, locale)}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {rule.active ? t("recurring.next") : t("recurring.paused")} ·{" "}
                  {fmtDate(rule.nextInstallmentAt)}
                  {rule.isTransfer
                    ? ` · ${rule.accountName ?? ""} → ${rule.transferToAccountName ?? ""}`
                    : rule.accountName
                      ? ` · ${rule.accountName}`
                      : ""}
                </p>
                <p className="truncate text-xs tabular-nums text-muted-foreground">
                  {t("recurring.monthStatus", {
                    total: fmtMoney(rule.totalThisMonth, baseCurrency),
                    paid: fmtMoney(rule.paidThisMonth, baseCurrency),
                    due: fmtMoney(rule.dueThisMonth, baseCurrency),
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`font-semibold tabular-nums ${
                    rule.isTransfer
                      ? "text-foreground"
                      : rule.type === "income"
                        ? "text-income"
                        : "text-expense"
                  }`}
                >
                  {rule.isTransfer ? "" : rule.type === "income" ? "+" : "−"}
                  {fmtMoney(rule.amount, rule.currency)}
                </span>
                {rule.currency !== baseCurrency && (
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                    ≈ {fmtMoney(rule.amountBase, baseCurrency)}
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t("recurring.ruleActions")}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => runNow.mutate(rule.id)}
                    disabled={runNow.isPending}
                  >
                    <Zap className="size-4" aria-hidden /> {t("recurring.runNow")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => recalculate.mutate(rule.id)}
                    disabled={recalculate.isPending}
                  >
                    <RefreshCw className="size-4" aria-hidden /> {t("recurring.recalculate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setForm(toFormValues(rule));
                      setEditingId(rule.id);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden /> {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleActive.mutate(rule)}>
                    {rule.active ? (
                      <>
                        <Pause className="size-4" aria-hidden /> {t("recurring.pause")}
                      </>
                    ) : (
                      <>
                        <Play className="size-4" aria-hidden /> {t("recurring.resume")}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeletingId(rule.id)}>
                    <Trash2 className="size-4" aria-hidden /> {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("recurring.createTitle")}</DialogTitle>
            <DialogDescription>{t("recurring.createDescription")}</DialogDescription>
          </DialogHeader>
          <RecurringForm
            values={form}
            onValuesChange={setForm}
            onSubmit={(input) =>
              create.mutate(input, { onSuccess: () => setCreating(false) })
            }
            onCancel={() => setCreating(false)}
            pending={create.isPending}
            error={create.error instanceof ApiError ? create.error.message : null}
            submitLabel={t("recurring.createRule")}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editingRule != null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("recurring.editTitle")}</DialogTitle>
            <DialogDescription>{t("recurring.editDescription")}</DialogDescription>
          </DialogHeader>
          <RecurringForm
            values={form}
            onValuesChange={setForm}
            onSubmit={(input) =>
              editingRule && update.mutate(
                { id: editingRule.id, input },
                { onSuccess: () => setEditingId(null) },
              )
            }
            onCancel={() => setEditingId(null)}
            pending={update.isPending}
            error={update.error instanceof ApiError ? update.error.message : null}
            submitLabel={t("common.saveChanges")}
            editing
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deletingId != null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recurring.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("recurring.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deletingId && deleteRule.mutate(deletingId)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
