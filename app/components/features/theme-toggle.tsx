import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getStoredTheme, storeTheme, type Theme } from "@/lib/theme";

const NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    storeTheme(next);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={cycle} aria-label={t("theme.toggleAria")}>
          {theme === "light" && <Sun className="size-4" aria-hidden />}
          {theme === "dark" && <Moon className="size-4" aria-hidden />}
          {theme === "system" && <Monitor className="size-4" aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("theme.tooltip", { theme: t(`theme.${theme}`) })}</TooltipContent>
    </Tooltip>
  );
}
