import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { MonthNav } from "@/components/features/month-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { backend } from "../backend";
import type { Bootstrap } from "../types";
import { currentMonth } from "@/lib/dates";

export function BudgetsPage({
  boot,
  refreshKey,
  onChanged,
}: {
  boot: Bootstrap;
  refreshKey: number;
  onChanged: () => void;
}) {
  const { t, fmtMoney } = useI18n();
  const [month, setMonth] = useState(currentMonth);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    backend
      .ListBudgets(month)
      .then((items) => {
        setAmounts(Object.fromEntries(items.map((item) => [item.categoryId, item.amount])));
        setSpent(Object.fromEntries(items.map((item) => [item.categoryId, item.spent])));
      })
      .catch(() => undefined);
  }, [month, refreshKey]);

  async function save() {
    setSaving(true);
    try {
      await backend.SaveBudgets(
        boot.categories
          .filter((category) => category.kind === "expense" && (amounts[category.id] ?? 0) > 0)
          .map((category) => ({
            categoryId: category.id,
            amount: amounts[category.id],
            rollover: false,
          })),
      );
      toast.success(t("budgets.saved"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("budgets.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const categories = boot.categories.filter((category) => category.kind === "expense");
  const total = Object.values(amounts).reduce((sum, value) => sum + value, 0);
  const totalSpent = Object.values(spent).reduce((sum, value) => sum + value, 0);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("budgets.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("budgets.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav month={month} onChange={setMonth} future />
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : t("budgets.save")}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("budgets.totalBudget")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {fmtMoney(total, boot.profile.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("budgets.spentThisMonth")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-expense">
              {fmtMoney(totalSpent, boot.profile.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("budgets.remaining")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {fmtMoney(total - totalSpent, boot.profile.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2">
        {categories.map((category) => {
          const budget = amounts[category.id] ?? 0;
          const used = spent[category.id] ?? 0;
          const progress = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
          return (
            <Card key={category.id}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: category.color || "var(--muted-foreground)" }}
                  />
                  <span className="flex-1 font-medium">{category.name}</span>
                  <Input
                    className="w-32 text-right"
                    inputMode="decimal"
                    value={amounts[category.id] || ""}
                    placeholder="0.00"
                    onChange={(event) =>
                      setAmounts({
                        ...amounts,
                        [category.id]: Number(event.target.value) || 0,
                      })
                    }
                  />
                </div>
                {budget > 0 && (
                  <>
                    <Progress value={progress} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {fmtMoney(used, boot.profile.currency)} /{" "}
                        {fmtMoney(budget, boot.profile.currency)}
                      </span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
