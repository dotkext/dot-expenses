import {
  CalendarClock,
  Banknote,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useI18n } from "@/components/i18n-provider";
import { AccountIcon } from "@/components/features/account-icon";
import { CategoryIcon } from "@/components/features/category-icon";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { WidgetProps } from "@/components/widgets/registry";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--muted-foreground)",
];

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  currency: string;
}) {
  const { fmtMoney } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium tabular-nums text-popover-foreground">
            {entry.value == null ? "—" : fmtMoney(Number(entry.value), currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly stats (standalone widgets)                                  */
/* ------------------------------------------------------------------ */

function StatWidget({
  value,
  hint,
  valueTone,
  hintTone,
}: {
  value: string;
  hint: string;
  valueTone?: "income" | "expense";
  hintTone?: "income" | "expense";
}) {
  return (
    <div className="flex h-full min-w-0 flex-col justify-center gap-1">
      <span
        className={`truncate text-2xl font-semibold tabular-nums ${
          valueTone === "income" ? "text-income" : valueTone === "expense" ? "text-expense" : ""
        }`}
      >
        {value}
      </span>
      <span
        className={`truncate text-xs tabular-nums ${
          hintTone === "income"
            ? "text-income"
            : hintTone === "expense"
              ? "text-expense"
              : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </div>
  );
}

export function IncomeWidget({ summary }: WidgetProps) {
  const { t, fmtMoney } = useI18n();
  const c = summary.baseCurrency;
  const { totals, prevTotals } = summary;
  const delta = prevTotals.income ? totals.income - prevTotals.income : null;

  return (
    <StatWidget
      value={fmtMoney(totals.income, c)}
      hint={
        delta != null
          ? t("widgets.vsLastMonth", { amount: fmtMoney(delta, c, true) })
          : t("widgets.noDataLastMonth")
      }
      valueTone="income"
      hintTone={delta == null ? undefined : delta >= 0 ? "income" : "expense"}
    />
  );
}

export function ExpensesWidget({ summary }: WidgetProps) {
  const { t, fmtMoney } = useI18n();
  const c = summary.baseCurrency;
  const { totals, prevTotals } = summary;
  const delta = prevTotals.expense ? totals.expense - prevTotals.expense : null;

  return (
    <StatWidget
      value={fmtMoney(totals.expense, c)}
      hint={
        delta != null
          ? t("widgets.vsLastMonth", { amount: fmtMoney(delta, c, true) })
          : t("widgets.noDataLastMonth")
      }
      valueTone="expense"
      hintTone={delta == null ? undefined : delta > 0 ? "expense" : "income"}
    />
  );
}

export function NetWidget({ summary }: WidgetProps) {
  const { t, fmtMoney } = useI18n();
  const c = summary.baseCurrency;
  const net = summary.totals.net;
  const tone = net >= 0 ? "income" : "expense";

  return (
    <StatWidget
      value={fmtMoney(net, c)}
      hint={net >= 0 ? t("widgets.inTheBlack") : t("widgets.overspending")}
      valueTone={tone}
      hintTone={tone}
    />
  );
}

export function SavingsRateWidget({ summary }: WidgetProps) {
  const { t, fmtPercent } = useI18n();
  const rate = summary.totals.savingsRate;

  return (
    <StatWidget
      value={rate == null ? "—" : fmtPercent(rate * 100)}
      hint={t("widgets.ofIncomeKept")}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Cash flow (bars)                                                    */
/* ------------------------------------------------------------------ */

export function CashFlowWidget({ summary }: WidgetProps) {
  const { t, fmtCompact } = useI18n();

  if (summary.cashFlow.every((m) => m.income === 0 && m.expense === 0)) {
    return <EmptyState message={t("widgets.emptyCashflow")} />;
  }

  return (
    <div className="h-full pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={summary.cashFlow}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value: number) => (value === 0 ? "0" : fmtCompact(value))}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={(props) => (
              <ChartTooltip {...(props as object)} currency={summary.baseCurrency} />
            )}
          />
          <Bar
            dataKey="income"
            name={t("widgets.income")}
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="expense"
            name={t("widgets.expenses")}
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categories (donut)                                                  */
/* ------------------------------------------------------------------ */

export function CategoriesWidget({ summary }: WidgetProps) {
  const { t, fmtMoney, fmtPercent } = useI18n();
  const data = summary.categories.filter((c) => c.amount > 0);
  if (data.length === 0) {
    return <EmptyState message={t("widgets.emptyCategories")} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <ChartTooltip {...(props as object)} currency={summary.baseCurrency} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-1.5 overflow-y-auto text-xs">
        {data.slice(0, 6).map((c, i) => (
          <li key={c.categoryId} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="truncate">{c.name}</span>
            <span className="ml-auto shrink-0 font-medium tabular-nums">
              {fmtMoney(c.amount, summary.baseCurrency)}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
              {fmtPercent(c.share * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend (cumulative areas)                                            */
/* ------------------------------------------------------------------ */

export function TrendWidget({ summary }: WidgetProps) {
  const { t, fmtCompact } = useI18n();
  const hasData = summary.trend.some((d) => d.current > 0 || d.previous > 0);
  if (!hasData) return <EmptyState message={t("widgets.emptyTrend")} />;

  const days = summary.trend.length;
  const labelEvery = days > 31 ? 7 : days > 10 ? 2 : 1;

  return (
    <div className="h-full pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={summary.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="trendPrevious" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            interval={labelEvery - 1}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value: number) => (value === 0 ? "0" : fmtCompact(value))}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip {...(props as object)} currency={summary.baseCurrency} />
            )}
          />
          <Area
            type="monotone"
            dataKey="previous"
            name={t("widgets.lastMonth")}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            fill="url(#trendPrevious)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="current"
            name={t("widgets.thisMonth")}
            stroke="var(--chart-2)"
            fill="url(#trendCurrent)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Budgets (progress list)                                             */
/* ------------------------------------------------------------------ */

export function BudgetsWidget({ summary }: WidgetProps) {
  const { t, fmtMoney } = useI18n();
  const budgets = [...summary.budgets].sort((a, b) => b.progress - a.progress).slice(0, 6);
  if (budgets.length === 0) {
    return <EmptyState message={t("widgets.emptyBudgets")} />;
  }

  return (
    <ul className="grid h-full content-start gap-3 overflow-y-auto">
      {budgets.map((b) => {
        const over = b.spent > b.allowance;
        return (
          <li key={b.categoryId} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CategoryIcon icon={b.categoryIcon} color={b.categoryColor} />
                <span className="truncate font-medium">{b.categoryName}</span>
                {b.rollover && (
                  <Badge variant="outline" className="px-1 py-0 text-[10px]">
                    {t("widgets.rollover")}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {fmtMoney(b.spent, summary.baseCurrency)} /{" "}
                {fmtMoney(b.allowance, summary.baseCurrency)}
              </span>
            </div>
            <Progress
              value={Math.min(100, b.progress * 100)}
              className={over ? "bg-muted [&>div]:bg-expense" : undefined}
            />
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Recent transactions                                                 */
/* ------------------------------------------------------------------ */

export function RecentWidget({ summary }: WidgetProps) {
  const { t, fmtDateShort, fmtMoney } = useI18n();
  if (summary.recent.length === 0) {
    return <EmptyState message={t("widgets.emptyRecent")} />;
  }

  return (
    <ul className="grid h-full content-start gap-1 overflow-y-auto">
      {summary.recent.map((tx) => (
        <li
          key={tx.id}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
        >
          <CategoryIcon icon={tx.categoryIcon} color={tx.categoryColor} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {tx.merchantName ?? tx.notes ?? tx.categoryName ?? t("tx.fallback")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {fmtDateShort(tx.date)}
              {tx.categoryName ? ` · ${tx.categoryName}` : ""}
              {tx.accountName ? ` · ${tx.accountName}` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 font-medium tabular-nums ${
              tx.type === "income" ? "text-income" : "text-expense"
            }`}
          >
            {tx.type === "income" ? "+" : "−"}
            {fmtMoney(tx.amount, tx.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Upcoming recurring                                                  */
/* ------------------------------------------------------------------ */

export function UpcomingWidget({ summary }: WidgetProps) {
  const { t, fmtDateShort, fmtMoney } = useI18n();
  const upcoming = summary.upcoming.slice(0, 8);
  if (upcoming.length === 0) {
    return <EmptyState message={t("widgets.emptyUpcoming")} />;
  }

  return (
    <ul className="grid h-full content-start gap-1 overflow-y-auto">
      {upcoming.map((u, i) => (
        <li
          key={`${u.ruleId}-${u.date}-${i}`}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
        >
          <CalendarClock
            className={`size-4 shrink-0 ${u.type === "income" ? "text-income" : "text-expense"}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{u.label}</p>
            <p className="text-xs text-muted-foreground">{fmtDateShort(u.date)}</p>
          </div>
          <span
            className={`shrink-0 font-medium tabular-nums ${
              u.type === "income" ? "text-income" : "text-expense"
            }`}
          >
            {u.type === "income" ? "+" : "−"}
            {fmtMoney(u.amount, u.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Account balances                                                    */
/* ------------------------------------------------------------------ */

export function AccountsWidget({ summary }: WidgetProps) {
  const { t, fmtMoney } = useI18n();
  const total = summary.accounts.reduce((sum, a) => sum + a.balance, 0);
  if (summary.accounts.length === 0) {
    return <EmptyState message={t("widgets.emptyAccounts")} />;
  }

  return (
    <div className="grid h-full content-center gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Banknote className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">{t("widgets.total")}</span>
        <span className="ml-auto text-base font-semibold tabular-nums">
          {fmtMoney(total, summary.baseCurrency)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {summary.accounts.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-2 text-sm">
            <AccountIcon type={a.type} className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">{a.name}</span>
            <span className="font-medium tabular-nums">
              {fmtMoney(a.balance, summary.baseCurrency)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
