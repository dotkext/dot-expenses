import { useNavigate } from "react-router";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  LayoutDashboard,
  ListOrdered,
  Repeat,
  Settings,
  Wallet,
  CalendarRange,
} from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useEffect } from "react";
import { useUiStore } from "@/stores/ui";

/** Cmd/Ctrl+K command palette: navigation + quick actions. */
export function CommandMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { commandOpen, setCommandOpen, openQuickAdd } = useUiStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [commandOpen, setCommandOpen]);

  const run = (fn: () => void) => {
    setCommandOpen(false);
    fn();
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder={t("command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("command.noResults")}</CommandEmpty>
        <CommandGroup heading={t("command.actions")}>
          <CommandItem onSelect={() => run(() => openQuickAdd("expense"))}>
            <ArrowUpCircle className="size-4 text-expense" aria-hidden />
            {t("command.addExpense")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => openQuickAdd("income"))}>
            <ArrowDownCircle className="size-4 text-income" aria-hidden />
            {t("command.addIncome")}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("command.navigate")}>
          <CommandItem onSelect={() => run(() => navigate("/"))}>
            <LayoutDashboard className="size-4" aria-hidden />
            {t("nav.dashboard")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/transactions"))}>
            <ListOrdered className="size-4" aria-hidden />
            {t("nav.transactions")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/recurring"))}>
            <Repeat className="size-4" aria-hidden />
            {t("nav.recurring")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/budgets"))}>
            <CalendarRange className="size-4" aria-hidden />
            {t("nav.budgets")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/accounts"))}>
            <Wallet className="size-4" aria-hidden />
            {t("nav.accounts")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/settings"))}>
            <Settings className="size-4" aria-hidden />
            {t("nav.settings")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
