import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addMonths, currentMonth, isValidMonthStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Month switcher used by the dashboard and budgets pages. */
export function MonthNav({
  month,
  onChange,
  future = false,
}: {
  month: string;
  onChange: (month: string) => void;
  /** Allow navigating into the future (budgets) or stop at the current month. */
  future?: boolean;
}) {
  const { t, fmtMonth, fmtMonthName } = useI18n();
  const valid = isValidMonthStr(month) ? month : currentMonth();
  const isCurrent = valid === currentMonth();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(Number(valid.slice(0, 4)));

  useEffect(() => {
    if (open) setViewYear(Number(valid.slice(0, 4)));
  }, [open, valid]);

  const now = currentMonth();
  const months = Array.from({ length: 12 }, (_, index) => {
    const value = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
    return { value, name: fmtMonthName(value) };
  });

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => onChange(addMonths(valid, -1))}
        aria-label={t("month.previous")}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("month.selectMonth")}
            className="h-8 w-36 justify-center gap-1 px-2 text-sm font-medium"
          >
            <span className="truncate capitalize tabular-nums">{fmtMonth(valid)}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setViewYear((year) => year - 1)}
              aria-label={t("month.previousYear")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setViewYear((year) => year + 1)}
              aria-label={t("month.nextYear")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {months.map(({ value, name }) => {
              const selected = value === valid;
              const disabled = !future && value > now;
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "ghost"}
                  className={cn(
                    "h-8 px-1 text-xs capitalize",
                    !selected && value === now && "ring-1 ring-border",
                  )}
                  disabled={disabled}
                  onClick={() => {
                    onChange(value);
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>

          <div className="mt-3 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(now);
                setOpen(false);
              }}
            >
              {t("month.today")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => onChange(addMonths(valid, 1))}
        disabled={!future && isCurrent}
        aria-label={t("month.next")}
      >
        <ChevronRight className="size-4" />
      </Button>

      {/* Fixed slot so showing "Today" never shifts the rest of the row. */}
      <div className="flex w-20 justify-end">
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => onChange(currentMonth())}
          >
            {t("month.today")}
          </Button>
        )}
      </div>
    </div>
  );
}
