import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/planned";
import { CalendarClock, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { AccountSelect } from "@/components/features/account-select";
import { CategorySelect } from "@/components/features/category-select";
import { CategoryIcon } from "@/components/features/category-icon";
import { DatePicker } from "@/components/features/date-picker";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { PlannedTransactionDTO } from "@/lib/types";
import { requireAuth } from "@/server/auth.service";
import { listPlanned } from "@/server/planned.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  return { items: await listPlanned(user), currency: user.currency };
}

type PlannedForm = {
  name: string;
  type: "expense" | "income";
  amount: string;
  categoryId: string | null;
  accountId: string | null;
  notes: string;
  targetMonth: string;
  installments: string;
};

function emptyForm(): PlannedForm {
  return {
    name: "",
    type: "expense",
    amount: "",
    categoryId: null,
    accountId: null,
    notes: "",
    targetMonth: "",
    installments: "1",
  };
}

function toForm(item: PlannedTransactionDTO): PlannedForm {
  return {
    name: item.name,
    type: item.type,
    amount: String(item.amount),
    categoryId: item.categoryId,
    accountId: item.accountId,
    notes: item.notes ?? "",
    targetMonth: item.targetMonth ?? "",
    installments: String(item.installments),
  };
}

export default function PlannedPage({ loaderData }: Route.ComponentProps) {
  const { t, fmtMoney, fmtMonth } = useI18n();
  const { items, currency } = loaderData;
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState<PlannedTransactionDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<PlannedTransactionDTO | null>(null);
  const [form, setForm] = useState<PlannedForm>(emptyForm);

  async function refresh() {
    await revalidator.revalidate();
  }

  function payload() {
    return {
      name: form.name,
      type: form.type,
      amount: Number(form.amount.replace(",", ".")),
      categoryId: form.categoryId,
      accountId: form.accountId,
      notes: form.notes || null,
      targetMonth: form.targetMonth || null,
      installments: Number(form.installments) || 1,
    };
  }

  const create = useMutation({
    mutationFn: () => apiPost("/api/planned", payload()),
    onSuccess: async () => {
      setEditing(null);
      toast.success(t("planned.created"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const update = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/planned/${id}`, payload()),
    onSuccess: async () => {
      setEditing(null);
      toast.success(t("planned.updated"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/planned/${id}`),
    onSuccess: async () => {
      setDeleting(null);
      toast.success(t("planned.deleted"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const record = useMutation({
    mutationFn: (item: PlannedTransactionDTO) =>
      apiPost<{ done: boolean; amount: number }>(`/api/planned/${item.id}/record`),
    onSuccess: async (result) => {
      toast.success(t("planned.recorded", { amount: fmtMoney(result.amount, currency) }));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("planned.recordFailed")),
  });

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.type === "expense") acc.expense += item.remainingAmount;
        else acc.income += item.remainingAmount;
        return acc;
      },
      { expense: 0, income: 0 },
    );
  }, [items]);

  const groups = useMemo(() => {
    const map = new Map<string, PlannedTransactionDTO[]>();
    for (const item of items) {
      const key = item.targetMonth ?? "__none__";
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b),
    );
  }, [items]);

  const saving = create.isPending || update.isPending;
  const installmentPreview = Number(form.amount.replace(",", ".")) / Math.max(1, Number(form.installments) || 1);

  return (
    <div className="mx-auto grid max-w-[1100px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("planned.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("planned.subtitle")}</p>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setForm(emptyForm());
            setEditing("new");
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t("planned.add")}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("planned.summaryExpenses")}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-expense">
              −{fmtMoney(totals.expense, currency)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("planned.summaryIncome")}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-income">
              +{fmtMoney(totals.income, currency)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("planned.summaryOpen")}
            </span>
            <span className="text-2xl font-semibold tabular-nums">{items.length}</span>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border bg-card py-16 text-center">
          <div>
            <CalendarClock className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{t("planned.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("planned.emptyBody")}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-2"
              onClick={() => {
                setForm(emptyForm());
                setEditing("new");
              }}
            >
              <Plus className="size-4" aria-hidden /> {t("planned.add")}
            </Button>
          </div>
        </div>
      ) : (
        groups.map(([month, groupItems]) => (
          <Card key={month} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {month === "__none__" ? t("planned.noMonth") : fmtMonth(month)}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {groupItems.length}
              </span>
            </div>
            <CardContent className="p-0">
              <ul className="divide-y">
                {groupItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
                    {item.categoryName ? (
                      <CategoryIcon
                        icon={item.categoryIcon ?? "tag"}
                        color={item.categoryColor}
                        className="mt-0.5"
                      />
                    ) : (
                      <span className="mt-1 size-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{item.name}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {item.type === "income" ? t("common.income") : t("common.expense")}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.categoryName, item.accountName].filter(Boolean).join(" · ") ||
                          t("common.uncategorized")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.targetMonth
                          ? t("planned.nextMonth", {
                              month: fmtMonth(item.nextMonth ?? item.targetMonth),
                            })
                          : t("planned.noMonth")}
                        {item.installments > 1
                          ? ` · ${t("planned.progress", {
                              done: item.completedInstallments,
                              total: item.installments,
                            })}`
                          : ""}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-semibold tabular-nums">
                        {fmtMoney(item.remainingAmount, currency)}
                      </div>
                      {item.installments > 1 && (
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {t("planned.perInstallment", {
                            amount: fmtMoney(item.installmentAmount, currency),
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={record.isPending}
                        onClick={() => record.mutate(item)}
                        aria-label={t("planned.recordAria", { name: item.name })}
                      >
                        <Check className="size-4" aria-hidden />
                        <span className="hidden sm:inline">{t("planned.record")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        aria-label={t("planned.editAria", { name: item.name })}
                        onClick={() => {
                          setForm(toForm(item));
                          setEditing(item);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("planned.deleteAria", { name: item.name })}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? t("planned.newTitle") : t("planned.editTitle")}
            </DialogTitle>
            <DialogDescription>{t("planned.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim() || saving) return;
              if (editing === "new") create.mutate();
              else if (editing) update.mutate(editing.id);
            }}
          >
            <ToggleGroup
              type="single"
              value={form.type}
              onValueChange={(value) =>
                value &&
                setForm({ ...form, type: value as "expense" | "income", categoryId: null })
              }
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="expense" variant="outline" className="w-full">
                {t("common.expense")}
              </ToggleGroupItem>
              <ToggleGroupItem value="income" variant="outline" className="w-full">
                {t("common.income")}
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="grid gap-2">
              <Label htmlFor="plan-name">{t("common.name")}</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("planned.namePlaceholder")}
                maxLength={120}
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="plan-amount">{t("common.amount")}</Label>
                <Input
                  id="plan-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-installments">{t("planned.installments")}</Label>
                <Input
                  id="plan-installments"
                  type="number"
                  min={1}
                  max={60}
                  value={form.installments}
                  onChange={(event) => setForm({ ...form, installments: event.target.value })}
                />
              </div>
            </div>

            {installmentPreview > 0 && (
              <p className="-mt-2 text-xs text-muted-foreground">
                {Number(form.installments) > 1
                  ? t("planned.installmentHelp", {
                      amount: fmtMoney(installmentPreview, currency),
                      count: Number(form.installments),
                    })
                  : t("planned.installmentHelpOne", {
                      amount: fmtMoney(installmentPreview, currency),
                    })}
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("common.category")}</Label>
                <CategorySelect
                  value={form.categoryId}
                  onChange={(id) => setForm({ ...form, categoryId: id })}
                  kind={form.type}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("common.account")}</Label>
                <AccountSelect
                  value={form.accountId}
                  onChange={(id) => setForm({ ...form, accountId: id })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan-month">{t("planned.month")}</Label>
              <DatePicker
                id="plan-month"
                value={form.targetMonth}
                onChange={(month) => setForm({ ...form, targetMonth: month })}
                monthOnly
                clearable
              />
              <p className="text-xs text-muted-foreground">{t("planned.monthHelp")}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="plan-notes">{t("common.notes")}</Label>
              <Textarea
                id="plan-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={t("form.notesPlaceholder")}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!form.name.trim() || saving}>
                {saving
                  ? t("common.saving")
                  : editing === "new"
                    ? t("common.create")
                    : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("planned.deleteTitle", { name: deleting?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("planned.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              <Trash2 className="size-4" aria-hidden /> {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
