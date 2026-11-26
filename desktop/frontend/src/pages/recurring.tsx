import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { CurrencySelect } from "@/components/features/currency-select";
import { DatePicker } from "@/components/features/date-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { describeFrequency } from "@/lib/frequency";
import { todayStr } from "@/lib/dates";
import { backend } from "../backend";
import { AccountSelect, CategorySelect } from "../components/selects";
import type { Bootstrap, RecurringInput, RecurringRule } from "../types";

export function RecurringPage({
  boot,
  refreshKey,
  onChanged,
}: {
  boot: Bootstrap;
  refreshKey: number;
  onChanged: () => void;
}) {
  const { t, locale, fmtMoney, fmtDate } = useI18n();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [form, setForm] = useState<RecurringInput>(emptyForm(boot));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    backend.ListRecurring().then(setRules).catch(() => undefined);
  }, [refreshKey, boot]);

  function edit(rule: RecurringRule | null) {
    setEditing(rule);
    setForm(
      rule
        ? {
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            accountId: rule.accountId,
            transferToAccountId: rule.transferToAccountId,
            categoryId: rule.categoryId,
            merchant: rule.merchantName,
            label: rule.label,
            unit: rule.unit,
            interval: rule.interval,
            byDay: rule.byDay,
            startDate: rule.startDate,
            endDate: rule.endDate,
            active: rule.active,
          }
        : emptyForm(boot),
    );
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await backend.UpdateRecurring(editing.id, form);
        toast.success(t("recurring.updated"));
      } else {
        await backend.CreateRecurring(form);
        toast.success(t("recurring.created"));
      }
      setOpen(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function action(run: () => Promise<void>, message: string) {
    try {
      await run();
      toast.success(message);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failedShort"));
    }
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("recurring.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("recurring.activeCount", { count: rules.filter((rule) => rule.active).length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => action(() => backend.RecalculateAllRecurring(), t("recurring.recalculatedAll"))}
          >
            <RefreshCw className="size-4" /> {t("recurring.recalculateAll")}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => edit(null)}>
            <Plus className="size-4" /> {t("recurring.new")}
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-3 p-3">
              <Switch
                checked={rule.active}
                onCheckedChange={(active) =>
                  action(() => backend.SetRecurringActive(rule.id, active), t("recurring.updated"))
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {rule.label || (rule.isTransfer
                      ? t("recurring.transferTo", { account: rule.transferToAccountName })
                      : rule.merchantName || rule.categoryName || t("recurring.fallback"))}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {describeFrequency(
                      { unit: rule.unit as "day", interval: rule.interval, byDay: rule.byDay || null },
                      locale,
                    )}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {rule.active ? t("recurring.next") : t("recurring.paused")} ·{" "}
                  {fmtDate(rule.nextInstallmentAt)}
                  {rule.isTransfer
                    ? ` · ${rule.accountName} → ${rule.transferToAccountName}`
                    : rule.accountName
                      ? ` · ${rule.accountName}`
                      : ""}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("recurring.paidDue", {
                    paid: fmtMoney(rule.paidThisMonth, boot.profile.currency),
                    due: fmtMoney(rule.dueThisMonth, boot.profile.currency),
                  })}
                </p>
              </div>
              <span className="font-semibold tabular-nums">
                {fmtMoney(rule.amountBase, boot.profile.currency)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title={t("recurring.runNow")}
                  onClick={() => action(() => backend.RunRecurringNow(rule.id), t("recurring.runSuccess"))}
                >
                  <Zap className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title={t("recurring.recalculate")}
                  onClick={() => action(() => backend.RecalculateRecurring(rule.id), t("recurring.recalculated"))}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => edit(rule)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (!window.confirm(t("recurring.deleteTitle"))) return;
                    action(() => backend.DeleteRecurring(rule.id), t("recurring.deleted"));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
          {rules.length === 0 && (
            <li className="grid h-32 place-items-center text-center text-sm text-muted-foreground">
              {t("recurring.emptyTitle")}
            </li>
          )}
        </ul>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("recurring.editTitle") : t("recurring.createTitle")}</DialogTitle>
            <DialogDescription>
              {editing ? t("recurring.recalcWarning") : t("recurring.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={save}>
            <ToggleGroup
              type="single"
              value={form.transferToAccountId ? "transfer" : form.type}
              onValueChange={(value) => {
                if (!value) return;
                if (value === "transfer") {
                  setForm({ ...form, type: "expense", transferToAccountId: form.transferToAccountId || "", categoryId: "" });
                } else {
                  setForm({ ...form, type: value, transferToAccountId: "" });
                }
              }}
              className="grid w-full grid-cols-3"
            >
              <ToggleGroupItem value="expense" variant="outline" className="w-full">
                {t("common.expense")}
              </ToggleGroupItem>
              <ToggleGroupItem value="income" variant="outline" className="w-full">
                {t("common.income")}
              </ToggleGroupItem>
              <ToggleGroupItem value="transfer" variant="outline" className="w-full">
                {t("recurring.transfer")}
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="rc-amount">{t("common.amount")}</Label>
                <Input
                  id="rc-amount"
                  inputMode="decimal"
                  value={form.amount || ""}
                  onChange={(event) => setForm({ ...form, amount: Number(event.target.value) || 0 })}
                  required
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label>{t("common.currency")}</Label>
                <CurrencySelect value={form.currency} onChange={(currency) => setForm({ ...form, currency })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rc-label">{t("recurring.name")}</Label>
              <Input
                id="rc-label"
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder={t("recurring.namePlaceholder")}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{form.transferToAccountId ? t("recurring.fromAccount") : t("common.account")}</Label>
                <AccountSelect
                  accounts={boot.accounts}
                  value={form.accountId}
                  onChange={(accountId) => setForm({ ...form, accountId })}
                />
              </div>
              {form.transferToAccountId ? (
                <div className="grid gap-2">
                  <Label>{t("recurring.toAccount")}</Label>
                  <AccountSelect
                    accounts={boot.accounts}
                    value={form.transferToAccountId}
                    onChange={(transferToAccountId) => setForm({ ...form, transferToAccountId })}
                    exclude={form.accountId}
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>{t("common.category")}</Label>
                  <CategorySelect
                    categories={boot.categories}
                    value={form.categoryId}
                    onChange={(categoryId) => setForm({ ...form, categoryId })}
                    kind={form.type}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>{t("recurring.unitDay")}</Label>
                <Select value={form.unit} onValueChange={(unit) => setForm({ ...form, unit })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">{t("recurring.unitDay")}</SelectItem>
                    <SelectItem value="week">{t("recurring.unitWeek")}</SelectItem>
                    <SelectItem value="month">{t("recurring.unitMonth")}</SelectItem>
                    <SelectItem value="year">{t("recurring.unitYear")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("recurring.interval")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.interval}
                  onChange={(event) => setForm({ ...form, interval: Number(event.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("recurring.onDay")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={31}
                  value={form.byDay || ""}
                  onChange={(event) => setForm({ ...form, byDay: Number(event.target.value) || 0 })}
                  placeholder="—"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("recurring.firstOccurrence")}</Label>
                <DatePicker value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("recurring.endsOptional")}</Label>
                <DatePicker
                  value={form.endDate}
                  onChange={(endDate) => setForm({ ...form, endDate })}
                  clearable
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="rc-active">{t("common.active")}</Label>
              <Switch
                id="rc-active"
                checked={form.active}
                onCheckedChange={(active) => setForm({ ...form, active })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {editing ? t("common.save") : t("recurring.createRule")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyForm(boot: Bootstrap): RecurringInput {
  return {
    type: "expense",
    amount: 0,
    currency: boot.profile.currency,
    accountId: boot.accounts[0]?.id ?? "",
    transferToAccountId: "",
    categoryId: "",
    merchant: "",
    label: "",
    unit: "month",
    interval: 1,
    byDay: 0,
    startDate: todayStr(),
    endDate: "",
    active: true,
  };
}
