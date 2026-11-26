import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { AccountSelect } from "@/components/features/account-select";
import { CategorySelect } from "@/components/features/category-select";
import { CurrencySelect } from "@/components/features/currency-select";
import { DatePicker } from "@/components/features/date-picker";
import { MerchantCombobox } from "@/components/features/merchant-combobox";
import { Button } from "@/components/ui/button";
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
import { apiPatch, apiPost, ApiError } from "@/lib/api";
import { todayStr } from "@/lib/dates";
import type { TranslationKey } from "@/lib/i18n/core";
import { recurringInputSchema, type RecurringInput } from "@/lib/validation";

export type RecurringFormValues = {
  type: "expense" | "income";
  amount: string;
  currency: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  /** Destination account when this is a transfer; null for expense/income. */
  transferToAccountId: string | null;
  label: string;
  unit: "day" | "week" | "month" | "year";
  interval: string;
  byDay: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

export function emptyRecurringForm(baseCurrency: string): RecurringFormValues {
  return {
    type: "expense",
    amount: "",
    currency: baseCurrency,
    accountId: null,
    categoryId: null,
    merchant: null,
    transferToAccountId: null,
    label: "",
    unit: "month",
    interval: "1",
    byDay: "",
    startDate: todayStr(),
    endDate: "",
    active: true,
  };
}

const DAYS_1_TO_31 = Array.from({ length: 31 }, (_, i) => String(i + 1));

export function RecurringForm({
  values,
  onValuesChange,
  onSubmit,
  onCancel,
  pending,
  error,
  submitLabel,
  editing = false,
}: {
  values: RecurringFormValues;
  onValuesChange: (values: RecurringFormValues) => void;
  onSubmit: (input: RecurringInput) => void;
  onCancel: () => void;
  pending?: boolean;
  error?: string | null;
  submitLabel: string;
  /** Editing an existing rule can rebuild its generated transactions. */
  editing?: boolean;
}) {
  const { t, weekdayName } = useI18n();
  const [fieldError, setFieldError] = useState<string | null>(null);

  function set<K extends keyof RecurringFormValues>(key: K, value: RecurringFormValues[K]) {
    onValuesChange({ ...values, [key]: value });
  }

  const transferMode = values.transferToAccountId !== null;

  function setMode(mode: "expense" | "income" | "transfer") {
    if (mode === "transfer") {
      onValuesChange({
        ...values,
        type: "expense",
        transferToAccountId: values.transferToAccountId ?? "",
        categoryId: null,
        merchant: null,
      });
    } else {
      onValuesChange({ ...values, type: mode, transferToAccountId: null });
    }
  }

  function submit(e: React.FormEvent) {    e.preventDefault();
    setFieldError(null);
    const parsed = recurringInputSchema.safeParse({
      ...values,
      amount: values.amount.replace(",", "."),
      interval: Number(values.interval),
      byDay: values.byDay === "" ? null : Number(values.byDay),
      label: values.label || null,
      merchant: values.transferToAccountId !== null ? null : values.merchant,
      transferToAccountId: values.transferToAccountId || null,
      endDate: values.endDate || null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setFieldError(issue ? t(issue as TranslationKey) : t("errors.invalidInput"));
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <ToggleGroup
        type="single"
        value={transferMode ? "transfer" : values.type}
        onValueChange={(v) => v && setMode(v as "expense" | "income" | "transfer")}
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
            placeholder="0.00"
            className="h-12 text-2xl font-medium tabular-nums"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="rc-currency">{t("common.currency")}</Label>
          <CurrencySelect
            value={values.currency}
            onChange={(code) => set("currency", code)}
            className="h-12! min-w-0"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rc-label">{t("recurring.name")}</Label>
        <Input
          id="rc-label"
          placeholder={t("recurring.namePlaceholder")}
          value={values.label}
          onChange={(e) => set("label", e.target.value)}
        />
      </div>

      {transferMode ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>{t("recurring.fromAccount")}</Label>
            <AccountSelect value={values.accountId} onChange={(id) => set("accountId", id)} />
          </div>
          <div className="grid gap-2">
            <Label>{t("recurring.toAccount")}</Label>
            <AccountSelect
              value={values.transferToAccountId || null}
              onChange={(id) => set("transferToAccountId", id ?? "")}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("common.category")}</Label>
              <CategorySelect
                value={values.categoryId}
                onChange={(id) => set("categoryId", id)}
                kind={values.type}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.account")}</Label>
              <AccountSelect value={values.accountId} onChange={(id) => set("accountId", id)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("form.store")}</Label>
            <MerchantCombobox
              value={values.merchant}
              onSelect={(m) => set("merchant", m?.name ?? null)}
            />
          </div>
        </>
      )}

      <fieldset className="grid gap-3 rounded-lg border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          {t("recurring.repeats")}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rc-unit" className="text-xs">
              {t("recurring.every")}
            </Label>
            <Select
              value={values.unit}
              onValueChange={(v) => set("unit", v as RecurringFormValues["unit"])}
            >
              <SelectTrigger id="rc-unit" className="w-full">
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
          <div className="grid gap-1.5">
            <Label htmlFor="rc-interval" className="text-xs">
              {t("recurring.interval")}
            </Label>
            <Input
              id="rc-interval"
              type="number"
              min={1}
              max={365}
              value={values.interval}
              onChange={(e) => set("interval", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">
              {values.unit === "week"
                ? t("recurring.onWeekday")
                : values.unit === "month"
                  ? t("recurring.onDay")
                  : "—"}
            </Label>
            {values.unit === "week" ? (
              <Select value={values.byDay || "1"} onValueChange={(v) => set("byDay", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 7 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {weekdayName(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : values.unit === "month" ? (
              <Select value={values.byDay || ""} onValueChange={(v) => set("byDay", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("recurring.sameAsStart")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("recurring.sameAsStartDay")}</SelectItem>
                  {DAYS_1_TO_31.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input disabled placeholder="—" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rc-start" className="text-xs">
              {t("recurring.firstOccurrence")}
            </Label>
            <DatePicker
              id="rc-start"
              value={values.startDate}
              onChange={(date) => set("startDate", date)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rc-end" className="text-xs">
              {t("recurring.endsOptional")}
            </Label>
            <DatePicker
              id="rc-end"
              value={values.endDate}
              onChange={(date) => set("endDate", date)}
              clearable
            />
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="rc-active">{t("common.active")}</Label>
          <p className="text-xs text-muted-foreground">{t("recurring.activeHelp")}</p>
        </div>
        <Switch id="rc-active" checked={values.active} onCheckedChange={(v) => set("active", v)} />
      </div>

      {(fieldError || error) && <p className="text-sm text-destructive">{fieldError ?? error}</p>}

      {editing && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t("recurring.recalcWarning")}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Hook wrapper for create/update mutations shared by the recurring page. */
export function useRecurringMutations() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  async function refresh() {
    await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
  }

  const create = useMutation({
    mutationFn: (input: RecurringInput) => apiPost("/api/recurring", input),
    onSuccess: async () => {
      toast.success(t("recurring.created"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecurringInput }) =>
      apiPatch(`/api/recurring/${id}`, input),
    onSuccess: async () => {
      toast.success(t("recurring.updated"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  return { create, update, refresh };
}
