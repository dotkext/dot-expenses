export type Profile = {
  name: string;
  email: string;
  currency: string;
  locale: string;
};

export type Account = {
  id: string;
  name: string;
  type: string;
  startingBalance: number;
  color: string;
  isDefault: boolean;
  balance: number;
  transactionCount: number;
};

export type AccountInput = {
  name: string;
  type: string;
  startingBalance: number;
  color: string;
  isDefault: boolean;
};

export type Category = {
  id: string;
  name: string;
  kind: string;
  icon: string;
  color: string;
};

export type CategoryInput = {
  name: string;
  kind: string;
  icon: string;
  color: string;
};

export type Merchant = {
  id: string;
  name: string;
  defaultCategoryId: string;
  defaultAccountId: string;
  defaultCategoryName: string;
  usageCount: number;
};

export type MerchantInput = {
  name: string;
  defaultCategoryId: string;
  defaultAccountId: string;
};

export type Transaction = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  amountBase: number;
  exchangeRate: number;
  date: string;
  notes: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  merchantId: string;
  merchantName: string;
  recurringRuleId: string;
  transferGroupId: string;
  createdAt: string;
};

export type TransactionInput = {
  type: string;
  amount: number;
  currency: string;
  accountId: string;
  categoryId: string;
  merchant: string;
  date: string;
  notes: string;
  transferToId: string;
};

export type TransactionFilter = {
  month: string;
  search: string;
  type: string;
  categoryId: string;
  accountId: string;
  limit: number;
};

export type PlannedTransaction = {
  id: string;
  name: string;
  type: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  accountId: string;
  accountName: string;
  notes: string;
  targetMonth: string;
  installments: number;
  completedInstallments: number;
  installmentAmount: number;
  remainingAmount: number;
  nextMonth: string;
  createdAt: string;
};

export type PlannedInput = {
  name: string;
  type: string;
  amount: number;
  categoryId: string;
  accountId: string;
  notes: string;
  targetMonth: string;
  installments: number;
};

export type RecurringRule = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  amountBase: number;
  paidThisMonth: number;
  dueThisMonth: number;
  totalThisMonth: number;
  nextInstallmentAt: string;
  accountId: string;
  accountName: string;
  transferToAccountId: string;
  transferToAccountName: string;
  isTransfer: boolean;
  categoryId: string;
  categoryName: string;
  merchantName: string;
  label: string;
  unit: string;
  interval: number;
  byDay: number;
  startDate: string;
  endDate: string;
  nextRunAt: string;
  active: boolean;
};

export type RecurringInput = {
  type: string;
  amount: number;
  currency: string;
  accountId: string;
  transferToAccountId: string;
  categoryId: string;
  merchant: string;
  label: string;
  unit: string;
  interval: number;
  byDay: number;
  startDate: string;
  endDate: string;
  active: boolean;
};

export type BudgetProgress = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  spent: number;
  remaining: number;
  progress: number;
  rollover: boolean;
  allowance: number;
};

export type BudgetInput = {
  categoryId: string;
  amount: number;
  rollover: boolean;
};

export type DashboardTotals = {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
};

export type CashFlowPoint = {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  share: number;
};

export type TrendPoint = {
  day: number;
  current: number;
  previous: number;
};

export type UpcomingOccurrence = {
  ruleId: string;
  label: string;
  date: string;
  amount: number;
  currency: string;
  amountBase: number;
  type: string;
};

export type DashboardSummary = {
  month: string;
  baseCurrency: string;
  totals: DashboardTotals;
  prevTotals: DashboardTotals;
  cashFlow: CashFlowPoint[];
  categories: CategorySlice[];
  budgets: BudgetProgress[];
  trend: TrendPoint[];
  upcoming: UpcomingOccurrence[];
  accounts: Account[];
  recent: Transaction[];
};

export type RateOverrideInfo = { currency: string; rate: number };

export type RateInfo = {
  baseCurrency: string;
  fetchedAt: string;
  available: boolean;
  overrides: RateOverrideInfo[];
};

export type Bootstrap = {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  rates: RateInfo;
  dbPath: string;
};
