import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ListOrdered,
  PieChart,
  PiggyBank,
  Repeat,
  Scale,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import type { TranslationKey } from "@/lib/i18n/core";
import type { DashboardSummary } from "@/lib/types";

import {
  AccountsWidget,
  BudgetsWidget,
  CashFlowWidget,
  CategoriesWidget,
  ExpensesWidget,
  IncomeWidget,
  NetWidget,
  RecentWidget,
  SavingsRateWidget,
  TrendWidget,
  UpcomingWidget,
} from "@/components/widgets/widgets";

export type WidgetProps = { summary: DashboardSummary };

export type WidgetDef = {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
  component: ComponentType<WidgetProps>;
  /** Default react-grid-layout entry (12 columns). */
  default: { x: number; y: number; w: number; h: number; minW: number; minH: number };
};

/** All widgets are registered here — the saved layout only stores ids + geometry. */
export const WIDGETS: WidgetDef[] = [
  {
    id: "income",
    titleKey: "widgets.name.income",
    descriptionKey: "widgets.desc.income",
    icon: ArrowDownLeft,
    component: IncomeWidget,
    default: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "expenses",
    titleKey: "widgets.name.expenses",
    descriptionKey: "widgets.desc.expenses",
    icon: ArrowUpRight,
    component: ExpensesWidget,
    default: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "net",
    titleKey: "widgets.name.net",
    descriptionKey: "widgets.desc.net",
    icon: Scale,
    component: NetWidget,
    default: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "savings",
    titleKey: "widgets.name.savingsRate",
    descriptionKey: "widgets.desc.savingsRate",
    icon: PiggyBank,
    component: SavingsRateWidget,
    default: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    id: "cashflow",
    titleKey: "widgets.name.cashflow",
    descriptionKey: "widgets.desc.cashflow",
    icon: BarChart3,
    component: CashFlowWidget,
    default: { x: 0, y: 2, w: 7, h: 6, minW: 4, minH: 4 },
  },
  {
    id: "categories",
    titleKey: "widgets.name.categories",
    descriptionKey: "widgets.desc.categories",
    icon: PieChart,
    component: CategoriesWidget,
    default: { x: 7, y: 2, w: 5, h: 6, minW: 3, minH: 4 },
  },
  {
    id: "trend",
    titleKey: "widgets.name.trend",
    descriptionKey: "widgets.desc.trend",
    icon: TrendingUp,
    component: TrendWidget,
    default: { x: 0, y: 8, w: 7, h: 6, minW: 4, minH: 4 },
  },
  {
    id: "budgets",
    titleKey: "widgets.name.budgets",
    descriptionKey: "widgets.desc.budgets",
    icon: CalendarRange,
    component: BudgetsWidget,
    default: { x: 7, y: 8, w: 5, h: 6, minW: 3, minH: 4 },
  },
  {
    id: "recent",
    titleKey: "widgets.name.recent",
    descriptionKey: "widgets.desc.recent",
    icon: ListOrdered,
    component: RecentWidget,
    default: { x: 0, y: 14, w: 7, h: 7, minW: 4, minH: 4 },
  },
  {
    id: "upcoming",
    titleKey: "widgets.name.upcoming",
    descriptionKey: "widgets.desc.upcoming",
    icon: Repeat,
    component: UpcomingWidget,
    default: { x: 7, y: 14, w: 5, h: 7, minW: 3, minH: 4 },
  },
  {
    id: "accounts",
    titleKey: "widgets.name.accounts",
    descriptionKey: "widgets.desc.accounts",
    icon: Wallet,
    component: AccountsWidget,
    default: { x: 0, y: 21, w: 12, h: 4, minW: 4, minH: 3 },
  },
];

export function widgetDef(id: string): WidgetDef | undefined {
  return WIDGETS.find((w) => w.id === id);
}
