import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { DatePicker } from "@/components/features/date-picker";
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
import { backend } from "../backend";
import { AccountSelect, CategorySelect } from "../components/selects";
import type { Bootstrap, PlannedInput, PlannedTransaction } from "../types";

export function PlannedPage({
  boot,
  refreshKey,
  onChanged,
}: {
  boot: Bootstrap;
  refreshKey: number;
  onChanged: () => void;
}) {
  const { t, fmtMoney, fmtMonth } = useI18n();
  const [items, setItems] = useState<PlannedTransaction[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedTransaction | null>(null);
  const [form, setForm] = useState<PlannedInput>(emptyForm(boot));

  useEffect(() => {
    backend.ListPlanned().then(setItems).catch(() => undefined);
  }, [refreshKey, boot]);

  function edit(item: PlannedTransaction | null) {
    setEditing(item);
    setForm(
      item
        ? {
            name: item.name,
            type: item.type,
            amount: item.amount,
            categoryId: item.categoryId,
            accountId: item.accountId,
            notes: item.notes,
            targetMonth: item.targetMonth,
            installments: item.installments,
          }
        : emptyForm(boot),
    );
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editing) {
        await backend.UpdatePlanned(editing.id, form);
        toast.success(t("planned.updated"));
      } else {
        await backend.CreatePlanned(form);
        toast.success(t("planned.created"));
      }
      setOpen(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  async function record(item: PlannedTransaction) {
    try {
      await backend.RecordPlannedInstallment(item.id);
      toast.success(t("planned.recorded", { amount: fmtMoney(item.installmentAmount, boot.profile.currency) }));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("planned.recordFailed"));
    }
  }

  async function remove(item: PlannedTransaction) {
    if (!window.confirm(t("planned.deleteTitle", { name: item.name }))) return;
    try {
      await backend.DeletePlanned(item.id);
      toast.success(t("planned.deleted"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  const groups = new Map<string, PlannedTransaction[]>();
  for (const item of items) {
    const key = item.targetMonth || "__none__";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) =>
    a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b),
  );

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("planned.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("planned.subtitle")}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => edit(null)}>
          <Plus className="size-4" /> {t("planned.add")}
        </Button>
      </header>

      {items.length === 0 && (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="font-medium">{t("planned.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("planned.emptyBody")}</p>
        </div>
      )}

      {sorted.map(([month, group]) => (
        <Card key={month} className="overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {month === "__none__" ? t("planned.noMonth") : fmtMonth(month)}
          </div>
          <CardContent className="p-0">
            <ul className="divide-y">
              {group.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.name}</span>
                      <Badge variant="secondary">
                        {item.type === "income" ? t("common.income") : t("common.expense")}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[item.categoryName, item.accountName].filter(Boolean).join(" · ") ||
                        t("common.uncategorized")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.nextMonth
                        ? t("planned.nextMonth", { month: fmtMonth(item.nextMonth) })
                        : t("planned.noMonth")}
                      {item.installments > 1
                        ? ` · ${t("planned.progress", {
                            done: item.completedInstallments,
                            total: item.installments,
                          })}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {fmtMoney(item.remainingAmount, boot.profile.currency)}
                    </p>
                    {item.installments > 1 && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {t("planned.perInstallment", {
                          amount: fmtMoney(item.installmentAmount, boot.profile.currency),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => record(item)}>
                      <Check className="size-4" />
                      <span className="hidden sm:inline">{t("planned.record")}</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => edit(item)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("planned.editTitle") : t("planned.newTitle")}</DialogTitle>
            <DialogDescription>{t("planned.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={save}>
            <ToggleGroup
              type="single"
              value={form.type}
              onValueChange={(value) =>
                value && setForm({ ...form, type: value, categoryId: "" })
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
                required
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="plan-amount">{t("common.amount")}</Label>
                <Input
                  id="plan-amount"
                  inputMode="decimal"
                  value={form.amount || ""}
                  onChange={(event) =>
                    setForm({ ...form, amount: Number(event.target.value) || 0 })
                  }
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
                  onChange={(event) =>
                    setForm({ ...form, installments: Number(event.target.value) || 1 })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("common.category")}</Label>
                <CategorySelect
                  categories={boot.categories}
                  value={form.categoryId}
                  onChange={(categoryId) => setForm({ ...form, categoryId })}
                  kind={form.type}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("common.account")}</Label>
                <AccountSelect
                  accounts={boot.accounts}
                  value={form.accountId}
                  onChange={(accountId) => setForm({ ...form, accountId })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("planned.month")}</Label>
              <DatePicker
                value={form.targetMonth}
                onChange={(targetMonth) => setForm({ ...form, targetMonth })}
                monthOnly
                clearable
              />
              <p className="text-xs text-muted-foreground">{t("planned.monthHelp")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-notes">{t("common.notes")}</Label>
              <Textarea
                id="plan-notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={t("form.notesPlaceholder")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{editing ? t("common.save") : t("common.create")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyForm(boot: Bootstrap): PlannedInput {
  return {
    name: "",
    type: "expense",
    amount: 0,
    categoryId: "",
    accountId: boot.accounts[0]?.id ?? "",
    notes: "",
    targetMonth: "",
    installments: 1,
  };
}
