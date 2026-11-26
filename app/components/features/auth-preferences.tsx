import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Languages,
  Monitor,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useRevalidator } from "react-router";

import { useI18n } from "@/components/i18n-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { setLocaleCookie } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/core";
import { getStoredTheme, storeTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEMES: { value: Theme; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/**
 * Compact language menu plus a three-way theme switch, floating over the auth
 * backdrop. Language changes persist to the cookie and revalidate the root
 * loader so the whole screen switches immediately.
 */
export function AuthPreferences() {
  const { t, locale } = useI18n();
  const revalidator = useRevalidator();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => setTheme(getStoredTheme()), []);

  function changeLocale(next: Locale) {
    if (next === locale) return;
    setLocaleCookie(next);
    // Re-run the root loader so the whole auth screen switches language.
    void revalidator.revalidate();
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    storeTheme(next);
  }

  function themeLabel(value: Theme) {
    const label = t(`theme.${value}`);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-full border border-border/70 bg-background/60 p-1 shadow-sm backdrop-blur-xl sm:right-6 sm:top-6 dark:border-white/10 dark:bg-white/[0.04]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("common.language")}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Languages className="size-3.5" aria-hidden />
              {locale}
              <ChevronDown className="size-3 opacity-60" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1.5">
            {LOCALES.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => changeLocale(option)}
                className="gap-2 rounded-lg px-2.5 py-2"
              >
                <span className="flex-1">{t(`language.${option}`)}</span>
                <Check
                  className={cn(
                    "size-4 text-foreground",
                    option === locale ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-0.5 h-4 w-px bg-border/70 dark:bg-white/10" aria-hidden />

        {THEMES.map(({ value, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => changeTheme(value)}
                aria-label={themeLabel(value)}
                aria-pressed={theme === value}
                className={cn(
                  "grid size-7 place-items-center rounded-full transition-all duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  theme === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{themeLabel(value)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
