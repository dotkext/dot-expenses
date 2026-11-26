import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import type { Route } from "./+types/app-shell";

import { CommandMenu } from "@/components/features/command-menu";
import { QuickAddDialog, setBaseCurrencyHint } from "@/components/features/quick-add";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { useI18n } from "@/components/i18n-provider";
import { Logo } from "@/components/features/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiPost } from "@/lib/api";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListOrdered,
  ListTodo,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Repeat,
  Search,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserDTO, requireAuth } from "@/server/auth.service";
import type { UserDTO } from "@/lib/types";
import { useUiStore } from "@/stores/ui";

const SIDEBAR_KEY = "dot-sidebar-collapsed";

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", labelKey: "nav.transactions", icon: ListOrdered },
  { to: "/planned", labelKey: "nav.planned", icon: ListTodo },
  { to: "/recurring", labelKey: "nav.recurring", icon: Repeat },
  { to: "/budgets", labelKey: "nav.budgets", icon: CalendarRange },
  { to: "/accounts", labelKey: "nav.accounts", icon: Wallet },
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  return { user: await getUserDTO(user) };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="grid gap-1" aria-label={t("nav.main")}>
      {NAV_ITEMS.map((item) => {
        const { to, labelKey, icon: Icon } = item;
        const end = "end" in item ? item.end : undefined;
        const label = t(labelKey);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-accent text-accent-foreground",
                collapsed && "justify-center px-2",
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarActions({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const { openQuickAdd, setCommandOpen } = useUiStore();

  return (
    <div className="grid gap-1 p-2">
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          setCommandOpen(true);
        }}
        title={collapsed ? t("nav.search") : undefined}
        aria-label={t("nav.search")}
        className={cn(
          "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{t("nav.search")}</span>
            <kbd className="rounded bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
          </>
        )}
      </button>
      <Button
        size={collapsed ? "icon" : "sm"}
        className={cn("gap-2", collapsed ? "mx-auto" : "w-full")}
        onClick={() => {
          onNavigate?.();
          openQuickAdd();
        }}
        aria-label={t("nav.quickAdd")}
        title={collapsed ? t("nav.quickAdd") : undefined}
      >
        <Plus className="size-4" aria-hidden />
        {!collapsed && t("nav.add")}
      </Button>
    </div>
  );
}

function SidebarFooter({
  user,
  collapsed,
  onSignOut,
  onNavigate,
  onExpand,
}: {
  user: UserDTO;
  collapsed: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
  onExpand?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-1 border-t p-2">
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between pl-1")}>
        {!collapsed && (
          <span className="text-xs font-medium text-muted-foreground">{t("theme.label")}</span>
        )}
        <ThemeToggle />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("nav.accountMenu")}
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
              collapsed ? "justify-center" : "w-full",
            )}
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(user.name) || "?"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "center" : "start"}
          className="w-56"
        >
          <DropdownMenuLabel>
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings" onClick={onNavigate}>
              <Settings className="size-4" aria-hidden /> {t("nav.settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut} variant="destructive">
            <LogOut className="size-4" aria-hidden /> {t("nav.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {collapsed && onExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="mx-auto"
          onClick={onExpand}
          aria-label={t("nav.expandSidebar")}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

export default function AppShell({ loaderData }: Route.ComponentProps) {
  const user: UserDTO = loaderData.user;
  const { t } = useI18n();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openQuickAdd } = useUiStore();

  setBaseCurrencyHint(user.currency);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  // "n" opens quick add (when not typing in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        openQuickAdd();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openQuickAdd]);

  async function logout() {
    try {
      await apiPost("/api/auth/logout");
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-svh overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card transition-[width] md:flex",
            collapsed ? "w-14" : "w-56",
          )}
        >
          <div className={cn("flex h-14 items-center border-b px-3", collapsed && "justify-center px-0")}>
            {collapsed ? (
              <Logo iconOnly />
            ) : (
              <>
                <Logo className="text-base" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8 text-muted-foreground"
                  onClick={toggleCollapsed}
                  aria-label={t("nav.collapseSidebar")}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
              </>
            )}
          </div>

          <SidebarActions collapsed={collapsed} />

          <div className="flex-1 overflow-y-auto p-2">
            <SidebarNav collapsed={collapsed} />
          </div>

          <SidebarFooter
            user={user}
            collapsed={collapsed}
            onSignOut={logout}
            onExpand={collapsed ? toggleCollapsed : undefined}
          />
        </aside>

        {/* Mobile navigation */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed top-4 left-4 z-30 bg-background/80 shadow-sm backdrop-blur md:hidden"
              aria-label={t("nav.openMenu")}
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
            <div className="flex h-14 items-center border-b px-4">
              <Logo />
            </div>
            <SidebarActions collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="flex-1 overflow-y-auto p-2">
              <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
            <SidebarFooter
              user={user}
              collapsed={false}
              onSignOut={logout}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div
          className={cn(
            "flex h-svh min-h-0 flex-col overflow-hidden transition-[padding]",
            collapsed ? "md:pl-14" : "md:pl-56",
          )}
        >
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-16 md:p-6">
            <Outlet />
          </main>
        </div>

        {/* Mobile FAB */}
        <Button
          size="icon"
          className="fixed right-5 bottom-5 z-30 size-14 rounded-full shadow-lg md:hidden"
          onClick={() => openQuickAdd()}
          aria-label={t("nav.quickAdd")}
        >
          <Plus className="size-6" />
        </Button>

        <CommandMenu />
        <QuickAddDialog />
      </div>
    </TooltipProvider>
  );
}
