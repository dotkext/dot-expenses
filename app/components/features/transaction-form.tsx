import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { AccountSelect, useAccounts } from "@/components/features/account-select";
import { CategorySelect, useCategories } from "@/components/features/category-select";
import { CurrencySelect } from "@/components/features/currency-select";
import { DatePicker } from "@/components/features/date-picker";
import { MerchantCombobox } from "@/components/features/merchant-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayStr } from "@/lib/dates";
import type { TranslationKey } from "@/lib/i18n/core";
import { transactionInputSchema, type TransactionInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

export type TransactionFormValues = {
  type: "expense" | "income";
  amount: string;
  currency: string;
  accountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  date: string;
  notes: string | null;
};

export function defaultsFor(values?: Partial<TransactionFormValues>): TransactionFormValues {
  return {
    type: "expense",
    amount: "",
    currency: "USD",
    accountId: null,
    categoryId: null,
    merchant: null,
    date: todayStr(),
    notes: null,
    ...values,
  };
}

/**
 * Shared transaction fields for the quick-add dialog and the edit dialog.
 * Enter submits; merchant selection pre-fills category/account when empty.
 */
export function TransactionForm({
  values,
  onValuesChange,
  onSubmit,
  onCancel,
  pending,
  error,
  submitLabel,
  autoFocus,
}: {
  values: TransactionFormValues;
  onValuesChange: (values: TransactionFormValues) => void;
  onSubmit: (input: TransactionInput) => void;
  onCancel?: () => void;
  pending?: boolean;
  error?: string | null;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  // Defaults from the user's data (default account, base currency)
  useEffect(() => {
    onValuesChange((() => {
      const updates: Partial<TransactionFormValues> = {};
      const defaultAccount = accounts?.find((a) => a.isDefault) ?? accounts?.[0];
      if (!values.accountId && defaultAccount) updates.accountId = defaultAccount.id;
      return { ...values, ...updates };
    })());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts?.length]);

  function set<K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) {
    onValuesChange({ ...values, [key]: value });
  }

  function onMerchantSelect(merchant: {
    name: string;
    defaultCategoryId: string | null;
    defaultAccountId: string | null;
  } | null) {
    const next: TransactionFormValues = { ...values, merchant: merchant?.name ?? null };
    if (merchant) {
      if (merchant.defaultCategoryId) {
        const category = categories?.find((c) => c.id === merchant.defaultCategoryId);
        if (!category || category.kind === values.type) next.categoryId = merchant.defaultCategoryId;
      }
      if (merchant.defaultAccountId) next.accountId = merchant.defaultAccountId;
    }
    onValuesChange(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    const parsed = transactionInputSchema.safeParse({
      ...values,
      amount: values.amount.replace(",", "."),
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
        value={values.type}
        onValueChange={(v) => v && set("type", v as "expense" | "income")}
        className="grid grid-cols-2"
      >
        <ToggleGroupItem value="expense" variant="outline" className="gap-2">
          <ArrowUpCircle className="size-4 text-expense" aria-hidden />
          {t("common.expense")}
        </ToggleGroupItem>
        <ToggleGroupItem value="income" variant="outline" className="gap-2">
          <ArrowDownCircle className="size-4 text-income" aria-hidden />
          {t("common.income")}
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="grid gap-2">
          <Label htmlFor="tx-amount">{t("common.amount")}</Label>
          <Input
            id="tx-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            autoFocus={autoFocus}
            className="h-12 text-2xl font-medium tabular-nums"
            value={values.amount}
            onChange={(e) => set("amount", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tx-currency">{t("common.currency")}</Label>
          <CurrencySelect
            value={values.currency}
            onChange={(code) => set("currency", code)}
            disabled={values.type === "income" && false}
          />
        </div>
      </div>

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
        <MerchantCombobox value={values.merchant} onSelect={onMerchantSelect} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-date">{t("common.date")}</Label>
        <DatePicker
          id="tx-date"
          value={values.date}
          onChange={(date) => set("date", date)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tx-notes">{t("common.notes")}</Label>
        <Textarea
          id="tx-notes"
          rows={2}
          placeholder={t("form.notesPlaceholder")}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || null)}
        />
      </div>

      {(fieldError || error) && (
        <p className={cn("text-sm", "text-destructive")}>{fieldError ?? error}</p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : (submitLabel ?? t("common.save"))}
        </Button>
      </div>
    </form>
  );
}
