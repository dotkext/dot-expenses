import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/dashboard";

import { useI18n } from "@/components/i18n-provider";
import { MonthNav } from "@/components/features/month-nav";
import { DashboardGrid } from "@/components/widgets/dashboard-grid";
import { apiGet } from "@/lib/api";
import { currentMonth, isValidMonthStr } from "@/lib/dates";
import { qk } from "@/lib/query-keys";
import type { DashboardSummary, WidgetLayoutItem } from "@/lib/types";
import { requireAuth } from "@/server/auth.service";
import { getDashboardSummary, getLayout } from "@/server/dashboard.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const monthParam = new URL(request.url).searchParams.get("month");
  const month = isValidMonthStr(monthParam) ? monthParam : currentMonth();

  const [summary, layout] = await Promise.all([
    getDashboardSummary(user, month),
    getLayout(user.id),
  ]);

  return { summary, layout, month };
}

export default function DashboardPage({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  const [, setSearchParams] = useSearchParams();
  const month = loaderData.month;

  const summaryQuery = useQuery({
    queryKey: qk.dashboard(month),
    queryFn: () => apiGet<DashboardSummary>(`/api/dashboard/summary?month=${month}`),
    initialData: loaderData.summary,
    staleTime: 15_000,
  });

  function onMonthChange(next: string) {
    setSearchParams(next === currentMonth() ? {} : { month: next }, { replace: true });
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {summaryQuery.data?.baseCurrency
              ? t("dashboard.amountsIn", { currency: summaryQuery.data.baseCurrency })
              : ""}
          </p>
        </div>
        <MonthNav month={month} onChange={onMonthChange} />
      </header>

      <DashboardGrid
        summary={summaryQuery.data}
        initialLayout={loaderData.layout as WidgetLayoutItem[]}
        initialMonth={month}
      />
    </div>
  );
}
