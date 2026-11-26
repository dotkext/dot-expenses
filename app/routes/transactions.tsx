import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/transactions";
import { ChevronLeft, ChevronRight, Plus, Repeat, Search, SlidersHorizontal } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useAccounts } from "@/components/features/account-select";
import { useCategories } from "@/components/features/category-select";
import { CategoryIcon } from "@/components/features/category-icon";
import { TransactionRowMenu } from "@/components/features/transaction-row";
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
import { currentMonth, monthRange } from "@/lib/dates";
import { useUiStore } from "@/stores/ui";
import { listTransactions } from "@/server/transactions.service";
import { requireAuth } from "@/server/auth.service";

const FILTER_ALL = "__all__";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const sp = url.searchParams;

  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const month = sp.get("month") ?? currentMonth();
  const range = monthRange(month);
  const typeParam = sp.get("type");

  const result = await listTransactions(user.id, {
    q: sp.get("q") || undefined,
    type: typeParam === "expense" || typeParam === "income" ? typeParam : undefined,
    categoryId: sp.get("categoryId") || undefined,
    accountId: sp.get("accountId") || undefined,
    from: sp.get("from") || range.start,
    to: sp.get("to") || range.end,
    page,
    pageSize: 25,
  });

  return { result, month, baseCurrency: user.currency };
}

export default function TransactionsPage({ loaderData }: Route.ComponentProps) {
  const { t, fmtDateShort, fmtMoney } = useI18n();
  const { result, month } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const openQuickAdd = useUiStore((s) => s.openQuickAdd);

  // Local mirrors of URL params for smooth typing
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(() =>
    Boolean(searchParams.get("categoryId") || searchParams.get("accountId") || searchParams.get("type")),
  );

  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== q) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (q) next.set("q", q);
            else next.delete("q");
            next.delete("page");
            return next;
          },
          { replace: true },
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, searchParams, setSearchParams]);

  function setParam(key: string, value: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  const baseCurrency = loaderData.baseCurrency;
  const totals = useMemo(() => {
    const income = result.items
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amountBase, 0);
    const expense = result.items
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amountBase, 0);
    return { income, expense };
  }, [result]);

  const activeFilters = ["type", "categoryId", "accountId"].filter((key) =>
    searchParams.get(key),
  );

  const page = result.page;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("tx.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {result.total === 1
              ? t("tx.countOne", { count: result.total })
              : t("tx.countMany", { count: result.total })}
            {totals.income > 0 && (
              <>
                {" · "}
                <span className="text-income">
                  +{fmtMoney(totals.income, baseCurrency)}
                </span>
              </>
            )}
            {totals.expense > 0 && (
              <>
                {" · "}
                <span className="text-expense">
                  −{fmtMoney(totals.expense, baseCurrency)}
                </span>
              </>
            )}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => openQuickAdd()}>
          <Plus className="size-4" aria-hidden />
          {t("nav.add")}
        </Button>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder={t("tx.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t("tx.searchLabel")}
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("tx.filters")}
          {activeFilters.length > 0 && (
            <Badge className="ml-1 px-1.5 py-0">{activeFilters.length}</Badge>
          )}
        </Button>
        <Select
          value={searchParams.get("month") ?? month}
          onValueChange={(m) => setParam("month", m === currentMonth() ? null : m)}
        >
          <SelectTrigger className="h-9 w-36" size="sm" aria-label={t("tx.month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={currentMonth()}>{t("tx.thisMonth")}</SelectItem>
            <SelectItem value={prevMonth(currentMonth())}>{t("tx.lastMonth")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showFilters && (
        <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3">
          <Select
            value={searchParams.get("type") ?? FILTER_ALL}
            onValueChange={(v) => setParam("type", v === FILTER_ALL ? null : v)}
          >
            <SelectTrigger size="sm" aria-label={t("common.type")}>
              <SelectValue placeholder={t("common.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>{t("tx.allTypes")}</SelectItem>
              <SelectItem value="expense">{t("common.expenses")}</SelectItem>
              <SelectItem value="income">{t("common.income")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("categoryId") ?? FILTER_ALL}
            onValueChange={(v) => setParam("categoryId", v === FILTER_ALL ? null : v)}
          >
            <SelectTrigger size="sm" aria-label={t("common.category")}>
              <SelectValue placeholder={t("common.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>{t("tx.allCategories")}</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={searchParams.get("accountId") ?? FILTER_ALL}
            onValueChange={(v) => setParam("accountId", v === FILTER_ALL ? null : v)}
          >
            <SelectTrigger size="sm" aria-label={t("common.account")}>
              <SelectValue placeholder={t("common.account")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>{t("tx.allAccounts")}</SelectItem>
              {(accounts ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">{t("common.date")}</TableHead>
              <TableHead>{t("tx.description")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("common.category")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("common.account")}</TableHead>
              <TableHead className="text-right">{t("common.amount")}</TableHead>
              <TableHead className="w-12" aria-label={t("common.actions")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {t("tx.emptyPrefix")}{" "}
                  <kbd className="rounded bg-muted px-1.5 font-mono text-xs">n</kbd>{" "}
                  {t("tx.emptySuffix")}
                </TableCell>
              </TableRow>
            )}
            {result.items.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {fmtDateShort(tx.date)}
                </TableCell>
                <TableCell className="max-w-72">
                  <div className="flex items-center gap-2">
                    <CategoryIcon icon={tx.categoryIcon} color={tx.categoryColor} />
                    <span className="truncate font-medium">
                      {tx.merchantName ?? tx.notes ?? tx.categoryName ?? t("tx.fallback")}
                    </span>
                    {tx.recurringRuleId && (
                      <Badge
                        variant="outline"
                        className="gap-1 px-1.5 py-0 text-[10px] font-normal"
                      >
                        <Repeat className="size-2.5" aria-hidden />
                        {t("tx.auto")}
                      </Badge>
                    )}
                  </div>
                  {tx.merchantName && tx.notes && (
                    <p className="truncate text-xs text-muted-foreground">{tx.notes}</p>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {tx.categoryName ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: tx.categoryColor ?? "var(--muted-foreground)" }}
                      />
                      {tx.categoryName}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {tx.accountName ?? "—"}
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap text-right font-medium tabular-nums ${
                    tx.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {tx.type === "income" ? "+" : "−"}
                  {fmtMoney(tx.amount, tx.currency)}
                  {tx.currency !== baseCurrency &&
                    tx.exchangeRate != null &&
                    tx.exchangeRate !== 1 && (
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        ≈ {fmtMoney(tx.amountBase, baseCurrency)}
                      </span>
                    )}
                </TableCell>
                <TableCell>
                  <TransactionRowMenu transaction={tx} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("tx.page", { page, pages: pageCount })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden /> {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setParam("page", String(page + 1))}
            >
              {t("common.next")} <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
