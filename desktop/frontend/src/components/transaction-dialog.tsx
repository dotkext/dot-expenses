import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { backend } from "../backend";
import { todayStr } from "@/lib/dates";
import type { Bootstrap, Transaction, TransactionInput } from "../types";
import { AccountSelect, CategorySelect } from "./selects";

export function TransactionDialog({
  boot,
  open,
  onOpenChange,
  transaction,
  onSaved,
}: {
  boot: Bootstrap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<TransactionInput>(() => empty(boot));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        merchant: transaction.merchantName,
        date: transaction.date,
        notes: transaction.notes,
        transferToId: "",
      });
    } else {
      setForm(empty(boot));
    }
  }, [open, transaction, boot]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.amount || form.amount <= 0) return;
    setSaving(true);
    try {
      if (transaction) {
        await backend.UpdateTransaction(transaction.id, form);
        toast.success(t("tx.updated"));
      } else {
        await backend.CreateTransaction(form);
        toast.success(t("recurring.runSuccess"));
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? t("tx.editTitle") : t("quickAdd.title")}</DialogTitle>
          <DialogDescription>{t("quickAdd.description")}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
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

          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
            <div className="grid gap-2">
              <Label htmlFor="tx-amount">{t("common.amount")}</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount || ""}
                onChange={(event) =>
                  setForm({ ...form, amount: Number(event.target.value) || 0 })
                }
                required
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>{t("common.currency")}</Label>
              <CurrencySelect
                value={form.currency}
                onChange={(currency) => setForm({ ...form, currency })}
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
            <Label htmlFor="tx-merchant">{t("form.store")}</Label>
            <Input
              id="tx-merchant"
              value={form.merchant}
              onChange={(event) => setForm({ ...form, merchant: event.target.value })}
              placeholder={t("merchant.placeholder")}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("common.date")}</Label>
            <DatePicker
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-notes">{t("common.notes")}</Label>
            <Textarea
              id="tx-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder={t("form.notesPlaceholder")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving || form.amount <= 0}>
              {saving ? t("common.saving") : transaction ? t("common.save") : t("quickAdd.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function empty(boot: Bootstrap): TransactionInput {
  return {
    type: "expense",
    amount: 0,
    currency: boot.profile.currency,
    accountId: boot.accounts.find((account) => account.isDefault)?.id ?? boot.accounts[0]?.id ?? "",
    categoryId: "",
    merchant: "",
    date: todayStr(),
    notes: "",
    transferToId: "",
  };
}
