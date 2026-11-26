import { useEffect, useState } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { accountTypeKey } from "@/components/features/account-icon";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { backend } from "../backend";
import type { Account, AccountInput, Bootstrap } from "../types";
import type { AccountType } from "@/lib/types";

const COLORS = ["", "#22c55e", "#0ea5e9", "#8b5cf6", "#f97316", "#ec4899", "#eab308", "#64748b"];

export function AccountsPage({
  boot,
  onChanged,
  refreshKey,
}: {
  boot: Bootstrap;
  onChanged: () => void;
  refreshKey: number;
}) {
  const { t, fmtMoney } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>(boot.accounts);
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AccountInput>(emptyAccount());

  useEffect(() => {
    backend.ListAccounts().then(setAccounts).catch(() => undefined);
  }, [refreshKey, boot.accounts]);

  function edit(account: Account | null) {
    setEditing(account);
    setForm(
      account
        ? {
            name: account.name,
            type: account.type,
            startingBalance: account.startingBalance,
            color: account.color,
            isDefault: account.isDefault,
          }
        : emptyAccount(),
    );
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editing) {
        await backend.UpdateAccount(editing.id, form);
        toast.success(t("accounts.updated"));
      } else {
        await backend.CreateAccount(form);
        toast.success(t("accounts.created"));
      }
      setOpen(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  async function remove(account: Account) {
    if (!window.confirm(t("accounts.deleteTitle", { name: account.name }))) return;
    try {
      await backend.DeleteAccount(account.id, "", true);
      toast.success(t("accounts.deleted"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounts.deleteFailed"));
    }
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("accounts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("accounts.subtitle", { total: "" })}</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => edit(null)}>
          <Plus className="size-4" /> {t("accounts.new")}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid size-8 place-items-center rounded-md text-xs font-semibold"
                      style={{
                        background: `${account.color || "#64748b"}22`,
                        color: account.color || "var(--muted-foreground)",
                      }}
                    >
                      {account.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {t(accountTypeKey(account.type as AccountType))}
                      </p>
                    </div>
                    {account.isDefault && <Star className="size-3.5 fill-current text-yellow-500" />}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => edit(account)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(account)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="mt-5 text-2xl font-semibold tabular-nums">
                {fmtMoney(account.balance, boot.profile.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {account.transactionCount} {t("nav.transactions").toLowerCase()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("accounts.editTitle") : t("accounts.newTitle")}</DialogTitle>
            <DialogDescription>{t("accounts.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-2">
              <Label htmlFor="ac-name">{t("common.name")}</Label>
              <Input
                id="ac-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={t("accounts.namePlaceholder")}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.type")}</Label>
              <Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["bank", "card", "cash", "wallet", "other"].map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(accountTypeKey(type as AccountType))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-start">{t("accounts.startingBalance")}</Label>
              <Input
                id="ac-start"
                inputMode="decimal"
                value={form.startingBalance}
                onChange={(event) =>
                  setForm({ ...form, startingBalance: Number(event.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.color")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color || "none"}
                    type="button"
                    className={`size-7 rounded-full border-2 ${
                      form.color === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: color || "var(--muted)" }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
                <input
                  type="color"
                  value={form.color || "#64748b"}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                  className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  aria-label={t("accounts.customColor")}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="ac-default">{t("accounts.defaultAccount")}</Label>
              <Switch
                id="ac-default"
                checked={form.isDefault}
                onCheckedChange={(isDefault) => setForm({ ...form, isDefault })}
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

function emptyAccount(): AccountInput {
  return { name: "", type: "bank", startingBalance: 0, color: "", isDefault: false };
}
