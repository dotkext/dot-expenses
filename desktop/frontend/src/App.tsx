import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarRange,
  LayoutDashboard,
  ListOrdered,
  ListTodo,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";
import { Window } from "@wailsio/runtime";

import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toLocale } from "@/lib/i18n/core";

import { backend } from "./backend";
import { TitleBar } from "./titlebar";
import { TransactionDialog } from "./components/transaction-dialog";
import { DashboardPage } from "./pages/dashboard";
import { TransactionsPage } from "./pages/transactions";
import { AccountsPage } from "./pages/accounts";
import { PlannedPage } from "./pages/planned";
import { RecurringPage } from "./pages/recurring";
import { BudgetsPage } from "./pages/budgets";
import { SettingsDialog } from "./pages/settings";
import type { Bootstrap } from "./types";

type Page = "dashboard" | "transactions" | "planned" | "recurring" | "budgets" | "accounts";

const NAV = [
  { id: "dashboard", icon: LayoutDashboard, key: "nav.dashboard" },
  { id: "transactions", icon: ListOrdered, key: "nav.transactions" },
  { id: "planned", icon: ListTodo, key: "nav.planned" },
  { id: "recurring", icon: CalendarClock, key: "nav.recurring" },
  { id: "budgets", icon: CalendarRange, key: "nav.budgets" },
  { id: "accounts", icon: Wallet, key: "nav.accounts" },
] as const;

export function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend
      .Bootstrap()
      .then(setBoot)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        <TitleBar />
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-semibold">Could not open the local database</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        <TitleBar />
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <I18nProvider locale={toLocale(boot.profile.locale)}>
      <TooltipProvider delayDuration={200}>
        <DesktopApp initialBoot={boot} />
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
}

function DesktopApp({ initialBoot }: { initialBoot: Bootstrap }) {
  const [boot, setBoot] = useState(initialBoot);
  const [page, setPage] = useState<Page>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useI18n();

  async function refresh() {
    try {
      setBoot(await backend.Bootstrap());
      setRefreshKey((value) => value + 1);
    } catch {
      setRefreshKey((value) => value + 1);
    }
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
          <div className="p-3">
            <Button className="w-full gap-2" size="sm" onClick={() => setTransactionOpen(true)}>
              <Plus className="size-4" /> {t("nav.quickAdd")}
            </Button>
          </div>
          <nav className="grid gap-1 px-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPage(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    page === item.id && "bg-accent text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{t(item.key)}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto grid gap-2 border-t p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("theme.label")}</span>
              <ThemeToggle />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("nav.accountMenu")}
                  className="flex items-center gap-2 rounded-md p-1.5 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {(boot.profile.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{boot.profile.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {boot.profile.email || t("nav.accountMenu")}
                    </span>
                  </span>
                  <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-medium">{boot.profile.name}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {boot.profile.email || t("nav.accountMenu")}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings className="size-4" aria-hidden /> {t("nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void Window.Close()}>
                  <LogOut className="size-4" aria-hidden /> {t("nav.quit")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {page === "dashboard" && (
            <DashboardPage
              boot={boot}
              refreshKey={refreshKey}
              onNewTransaction={() => setTransactionOpen(true)}
            />
          )}
          {page === "transactions" && <TransactionsPage boot={boot} refreshKey={refreshKey} />}
          {page === "planned" && (
            <PlannedPage boot={boot} refreshKey={refreshKey} onChanged={refresh} />
          )}
          {page === "recurring" && (
            <RecurringPage boot={boot} refreshKey={refreshKey} onChanged={refresh} />
          )}
          {page === "budgets" && (
            <BudgetsPage boot={boot} refreshKey={refreshKey} onChanged={refresh} />
          )}
          {page === "accounts" && (
            <AccountsPage boot={boot} refreshKey={refreshKey} onChanged={refresh} />
          )}
        </main>
      </div>

      <TransactionDialog
        boot={boot}
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        onSaved={refresh}
      />

      <SettingsDialog
        boot={boot}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onChanged={refresh}
      />
    </div>
  );
}
