import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/accounts";
import { MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { AccountIcon, accountTypeKey } from "@/components/features/account-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api";
import type { AccountDTO, AccountType } from "@/lib/types";
import { ACCOUNT_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/server/auth.service";
import { listAccounts } from "@/server/accounts.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const accounts = await listAccounts(user.id);
  return { accounts, baseCurrency: user.currency };
}

type AccountForm = {
  name: string;
  type: AccountType;
  startingBalance: string;
  color: string | null;
  isDefault: boolean;
};

const COLOR_CHOICES = [
  null,
  "#22c55e",
  "#0ea5e9",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#eab308",
  "#64748b",
];

function emptyForm(): AccountForm {
  return { name: "", type: "bank", startingBalance: "0", color: null, isDefault: false };
}

export default function AccountsPage({ loaderData }: Route.ComponentProps) {
  const { t, fmtMoney } = useI18n();
  const { baseCurrency } = loaderData;
  const [accounts, setAccounts] = useState<AccountDTO[]>(loaderData.accounts);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AccountDTO | null>(null);
  const [deleting, setDeleting] = useState<AccountDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string>("");
  const [cascade, setCascade] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const customColor = form.color != null && !COLOR_CHOICES.includes(form.color);

  useEffect(() => setAccounts(loaderData.accounts), [loaderData.accounts]);

  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  async function refresh() {
    await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
  }

  const save = useMutation({
    mutationFn: async (input: AccountForm) => {
      const payload = {
        name: input.name,
        type: input.type,
        startingBalance: Number(input.startingBalance.replace(",", ".")) || 0,
        color: input.color,
        isDefault: input.isDefault,
      };
      if (editing) return apiPatch(`/api/accounts/${editing.id}`, payload);
      return apiPost("/api/accounts", payload);
    },
    onSuccess: async () => {
      setCreating(false);
      setEditing(null);
      toast.success(t(editing ? "accounts.updated" : "accounts.created"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("common.failedShort")),
  });

  const remove = useMutation({
    mutationFn: (account: AccountDTO) =>
      apiDelete(`/api/accounts/${account.id}`, {
        moveTo: deleteTarget || null,
        cascade,
      }),
    onSuccess: async () => {
      setDeleting(null);
      setDeleteTarget("");
      setCascade(false);
      toast.success(t("accounts.deleted"));
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("accounts.deleteFailed")),
  });

  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto grid max-w-[1000px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("accounts.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("accounts.subtitle", { total: fmtMoney(total, baseCurrency) })}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(emptyForm());
            setCreating(true);
          }}
        >
          {t("accounts.new")}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="grid h-40 place-items-center text-center">
              <div>
                <p className="font-medium">{t("accounts.emptyTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("accounts.emptyBody")}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {accounts.map((account) => (
          <Card key={account.id} className="relative">
            <CardContent className="grid gap-2 p-4">
              <div className="flex items-start gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `${account.color ?? "var(--muted)"}22`,
                    color: account.color ?? "var(--muted-foreground)",
                  }}
                >
                  <AccountIcon type={account.type} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium">{account.name}</p>
                    {account.isDefault && (
                      <Star
                        className="size-3.5 fill-current text-amber-500"
                        aria-label={t("accounts.defaultAria")}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(accountTypeKey(account.type))} ·{" "}
                    {account.transactionCount === 1
                      ? t("accounts.transactionCountOne", { count: account.transactionCount })
                      : t("accounts.transactionCountMany", {
                          count: account.transactionCount,
                        })}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t("accounts.actionsAria", { name: account.name })}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setForm({
                          name: account.name,
                          type: account.type,
                          startingBalance: String(account.startingBalance),
                          color: account.color,
                          isDefault: account.isDefault,
                        });
                        setEditing(account);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden /> {t("common.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteTarget("");
                        setCascade(false);
                        setDeleting(account);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden /> {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {fmtMoney(account.balance, baseCurrency)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("accounts.balanceNote", { currency: baseCurrency })}
      </p>

      {/* Create / edit dialog */}
      <Dialog
        open={creating || editing != null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(editing ? "accounts.editTitle" : "accounts.newTitle")}</DialogTitle>
            <DialogDescription>{t("accounts.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="ac-name">{t("common.name")}</Label>
              <Input
                id="ac-name"
                placeholder={t("accounts.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-type">{t("common.type")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as AccountType })}
              >
                <SelectTrigger id="ac-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(accountTypeKey(type))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ac-balance">{t("accounts.startingBalance")}</Label>
              <Input
                id="ac-balance"
                inputMode="decimal"
                value={form.startingBalance}
                onChange={(e) => setForm({ ...form, startingBalance: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.color")}</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_CHOICES.map((color) => (
                  <button
                    key={String(color)}
                    type="button"
                    aria-label={color ? t("accounts.colorAria", { color }) : t("common.noColor")}
                    className={`size-7 rounded-full border-2 ${
                      form.color === color ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: color ?? "var(--muted)" }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
                <label
                  className={cn(
                    "relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-full border-2 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    customColor ? "border-foreground" : "border-transparent",
                  )}
                >
                  <input
                    type="color"
                    value={form.color ?? "#64748b"}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    aria-label={t("accounts.customColor")}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                  <span
                    aria-hidden
                    className="size-full rounded-full"
                    style={{
                      background: customColor
                        ? form.color!
                        : "conic-gradient(from 210deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
                    }}
                  />
                  {!customColor && (
                    <Plus
                      className="pointer-events-none absolute size-3.5 text-white drop-shadow"
                      aria-hidden
                    />
                  )}
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="ac-default">{t("accounts.defaultAccount")}</Label>
              <Switch
                id="ac-default"
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending
                  ? t("common.saving")
                  : editing
                    ? t("common.saveChanges")
                    : t("accounts.createAccount")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("accounts.deleteTitle", { name: deleting?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {deleting && deleting.transactionCount > 0
                ? t("accounts.deleteHasTransactions", { count: deleting.transactionCount })
                : t("accounts.deleteEmpty")}
            </DialogDescription>
          </DialogHeader>
          {deleting && deleting.transactionCount > 0 && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>{t("accounts.moveTo")}</Label>
                <Select value={deleteTarget} onValueChange={setDeleteTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("accounts.chooseAccount")} />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== deleting.id)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="cascade">{t("accounts.cascade")}</Label>
                  <p className="text-xs text-muted-foreground">{t("accounts.cascadeHelp")}</p>
                </div>
                <Switch id="cascade" checked={cascade} onCheckedChange={setCascade} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting != null && deleting.transactionCount > 0 && !deleteTarget && !cascade}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              {t("accounts.deleteAccount")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
