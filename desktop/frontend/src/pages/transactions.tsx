import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { MonthNav } from "@/components/features/month-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { backend } from "../backend";
import { TransactionDialog } from "../components/transaction-dialog";
import type { Bootstrap, Transaction } from "../types";

export function TransactionsPage({
  boot,
  refreshKey,
}: {
  boot: Bootstrap;
  refreshKey: number;
}) {
  const { t, fmtMoney, fmtDate } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [items, setItems] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    backend
      .ListTransactions({
        month,
        search,
        type: type === "all" ? "" : type,
        categoryId: "",
        accountId: "",
        limit: 500,
      })
      .then((data) => !cancelled && setItems(data))
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t("common.failed")),
      );
    return () => {
      cancelled = true;
    };
  }, [month, search, type, refreshKey, localRefresh, t]);

  async function remove(tx: Transaction) {
    if (!window.confirm(t("tx.deleteTitle"))) return;
    try {
      await backend.DeleteTransaction(tx.id);
      toast.success(t("tx.deleted"));
      setLocalRefresh((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tx.deleteFailed"));
    }
  }

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("tx.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} {t("nav.transactions").toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> {t("nav.add")}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("tx.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tx.allTypes")}</SelectItem>
            <SelectItem value="expense">{t("common.expense")}</SelectItem>
            <SelectItem value="income">{t("common.income")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("tx.description")}</TableHead>
              <TableHead>{t("common.category")}</TableHead>
              <TableHead>{t("common.account")}</TableHead>
              <TableHead className="text-right">{t("common.amount")}</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {fmtDate(tx.date)}
                </TableCell>
                <TableCell className="max-w-56">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{tx.merchantName || tx.notes || t("tx.fallback")}</span>
                    {tx.transferGroupId && (
                      <Badge variant="secondary" className="text-[10px]">
                        Transfer
                      </Badge>
                    )}
                    {tx.recurringRuleId && !tx.transferGroupId && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("tx.auto")}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tx.categoryName || t("common.uncategorized")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tx.accountName || "—"}
                </TableCell>
                <TableCell
                  className={`text-right font-medium tabular-nums ${
                    tx.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {tx.type === "income" ? "+" : "−"}
                  {fmtMoney(tx.amountBase, boot.profile.currency)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={t("common.edit")}
                      onClick={() => {
                        setEditing(tx);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      aria-label={t("common.delete")}
                      onClick={() => remove(tx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  {t("tx.emptyPrefix")} {t("nav.quickAdd")} {t("tx.emptySuffix")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog
        boot={boot}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        onSaved={() => setLocalRefresh((value) => value + 1)}
      />
    </div>
  );
}
