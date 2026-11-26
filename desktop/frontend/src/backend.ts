import * as service from "../bindings/github.com/dotkext/dot-expenses/desktop/internal/api/service.js";
import type {
  Account,
  AccountInput,
  Bootstrap,
  BudgetInput,
  BudgetProgress,
  Category,
  CategoryInput,
  DashboardSummary,
  Merchant,
  MerchantInput,
  PlannedInput,
  PlannedTransaction,
  Profile,
  RateInfo,
  RateOverrideInfo,
  RecurringInput,
  RecurringRule,
  Transaction,
  TransactionFilter,
  TransactionInput,
} from "./types";

type Backend = {
  Bootstrap(): Promise<Bootstrap>;
  GetProfile(): Promise<Profile>;
  UpdateProfile(profile: Profile): Promise<Profile>;
  ListAccounts(): Promise<Account[]>;
  CreateAccount(input: AccountInput): Promise<Account>;
  UpdateAccount(id: string, input: AccountInput): Promise<Account>;
  DeleteAccount(id: string, moveTo: string, cascade: boolean): Promise<void>;
  ListCategories(): Promise<Category[]>;
  CreateCategory(input: CategoryInput): Promise<Category>;
  UpdateCategory(id: string, input: CategoryInput): Promise<Category>;
  DeleteCategory(id: string): Promise<void>;
  ListMerchants(): Promise<Merchant[]>;
  CreateMerchant(input: MerchantInput): Promise<Merchant>;
  UpdateMerchant(id: string, input: MerchantInput): Promise<Merchant>;
  DeleteMerchant(id: string): Promise<void>;
  ListTransactions(filter: TransactionFilter): Promise<Transaction[]>;
  GetTransaction(id: string): Promise<Transaction>;
  CreateTransaction(input: TransactionInput): Promise<Transaction>;
  UpdateTransaction(id: string, input: TransactionInput): Promise<Transaction>;
  DeleteTransaction(id: string): Promise<void>;
  DuplicateTransaction(id: string): Promise<Transaction>;
  ListPlanned(): Promise<PlannedTransaction[]>;
  CreatePlanned(input: PlannedInput): Promise<PlannedTransaction>;
  UpdatePlanned(id: string, input: PlannedInput): Promise<PlannedTransaction>;
  DeletePlanned(id: string): Promise<void>;
  RecordPlannedInstallment(id: string): Promise<Transaction>;
  ListRecurring(): Promise<RecurringRule[]>;
  CreateRecurring(input: RecurringInput): Promise<RecurringRule>;
  UpdateRecurring(id: string, input: RecurringInput): Promise<RecurringRule>;
  DeleteRecurring(id: string): Promise<void>;
  SetRecurringActive(id: string, active: boolean): Promise<void>;
  RunRecurringNow(id: string): Promise<void>;
  RecalculateRecurring(id: string): Promise<void>;
  RecalculateAllRecurring(): Promise<void>;
  RunDueRecurring(): Promise<void>;
  ListBudgets(month: string): Promise<BudgetProgress[]>;
  SaveBudgets(items: BudgetInput[]): Promise<void>;
  GetDashboard(month: string): Promise<DashboardSummary>;
  GetRates(): Promise<RateInfo>;
  RefreshRates(): Promise<RateInfo>;
  SaveRateOverride(override: RateOverrideInfo): Promise<void>;
  DeleteRateOverride(currency: string): Promise<void>;
};

export const backend = service as unknown as Backend;
