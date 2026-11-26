import { useState } from "react";
import { addYears } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentMonth, parseDay, toDay, todayStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Date input backed by the shadcn calendar (month/year dropdowns, a Today
 * shortcut and optional clearing) instead of the browser's native picker.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  monthOnly = false,
  clearable = false,
}: {
  /** "YYYY-MM-DD", or "YYYY-MM" when `monthOnly`. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Select a month for planning instead of an exact day. */
  monthOnly?: boolean;
  clearable?: boolean;
}) {
  const { t, fmtDate, fmtMonth } = useI18n();
  const [open, setOpen] = useState(false);

  const selected = value ? parseDay(monthOnly ? `${value.slice(0, 7)}-01` : value) : undefined;
  const defaultMonth = selected ?? parseDay(todayStr());
  const label = value
    ? monthOnly
      ? fmtMonth(value.slice(0, 7))
      : fmtDate(value)
    : (placeholder ?? t("common.date"));

  function pick(date: Date | undefined) {
    if (!date) return;
    onChange(monthOnly ? toDay(date).slice(0, 7) : toDay(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={defaultMonth}
          startMonth={addYears(defaultMonth, -10)}
          endMonth={addYears(defaultMonth, 10)}
          onSelect={pick}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(monthOnly ? currentMonth() : todayStr());
              setOpen(false);
            }}
          >
            {t("month.today")}
          </Button>
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("common.clear")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
