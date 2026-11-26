import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { MonthNav } from "@/components/features/month-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { backend } from "../backend";
import type { Bootstrap, DashboardSummary } from "../types";

export function DashboardPage({
  boot,
  onNewTransaction,
  refreshKey,
}: {
  boot: Bootstrap;
  onNewTransaction: () => void;
  refreshKey: number;
}) {
  const { t, fmtMoney, fmtPercent } = useI18n();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    backend
      .GetDashboard(month)
      .then((data) => !cancelled && setSummary(data))
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t("common.failed")),
      );
    return () => {
      cancelled = true;
    };
  }, [month, refreshKey, t]);

  const currency = boot.profile.currency;

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.amountsIn", { currency })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <Button size="sm" className="gap-2" onClick={onNewTransaction}>
            <Plus className="size-4" /> {t("nav.add")}
          </Button>
        </div>
      </header>

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={t("widgets.income")} value={fmtMoney(summary.totals.income, currency)} tone="income" />
            <Stat label={t("widgets.expenses")} value={fmtMoney(summary.totals.expense, currency)} tone="expense" />
            <Stat
              label={t("widgets.net")}
              value={fmtMoney(summary.totals.net, currency)}
              tone={summary.totals.net >= 0 ? "income" : "expense"}
            />
            <Stat
              label={t("widgets.savingsRate")}
              value={
                summary.totals.income > 0
                  ? fmtPercent(summary.totals.savingsRate * 100)
                  : "—"
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-4 text-sm font-semibold">{t("widgets.name.cashflow")}</h2>
                <CashFlow summary={summary} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-4 text-sm font-semibold">{t("widgets.name.categories")}</h2>
                <ul className="grid gap-2 text-xs">
                  {summary.categories.slice(0, 6).map((category) => (
                    <li key={category.categoryId || "none"} className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: category.color || "var(--muted-foreground)" }}
                      />
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      <span className="tabular-nums">{fmtMoney(category.amount, currency)}</span>
                      <span className="w-9 text-right tabular-nums text-muted-foreground">
                        {fmtPercent(category.share * 100)}
                      </span>
                    </li>
                  ))}
                  {summary.categories.length === 0 && (
                    <li className="text-muted-foreground">{t("widgets.emptyCategories")}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold">{t("widgets.name.recent")}</h2>
                <ul className="grid gap-1">
                  {summary.recent.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">
                        {tx.date.slice(5)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {tx.merchantName || tx.categoryName || tx.notes || t("tx.fallback")}
                      </span>
                      <span
                        className={`tabular-nums ${
                          tx.type === "income" ? "text-income" : "text-expense"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "−"}
                        {fmtMoney(tx.amountBase, currency)}
                      </span>
                    </li>
                  ))}
                  {summary.recent.length === 0 && (
                    <li className="text-sm text-muted-foreground">{t("widgets.emptyRecent")}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold">{t("widgets.name.accounts")}</h2>
                <ul className="grid gap-2">
                  {summary.accounts.map((account) => (
                    <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{account.name}</span>
                      <span className="font-medium tabular-nums">
                        {fmtMoney(account.balance, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={`truncate text-2xl font-semibold tabular-nums ${
            tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

function CashFlow({ summary }: { summary: DashboardSummary }) {
  const { fmtMoney } = useI18n();
  const max = Math.max(
    1,
    ...summary.cashFlow.flatMap((point) => [point.income, point.expense]),
  );
  return (
    <div className="flex h-52 items-end gap-4">
      {summary.cashFlow.map((point) => (
        <div key={point.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
          <div className="flex h-full items-end justify-center gap-1">
            <div
              className="w-2.5 rounded-t bg-income/80"
              style={{ height: point.income > 0 ? `${Math.max(2, (point.income / max) * 100)}%` : 0 }}
              title={fmtMoney(point.income, summary.baseCurrency)}
            />
            <div
              className="w-2.5 rounded-t bg-expense/80"
              style={{ height: point.expense > 0 ? `${Math.max(2, (point.expense / max) * 100)}%` : 0 }}
              title={fmtMoney(point.expense, summary.baseCurrency)}
            />
          </div>
          <span className="truncate text-center text-[10px] text-muted-foreground">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}
