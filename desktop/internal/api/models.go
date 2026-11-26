package api

type Profile struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Currency string `json:"currency"`
	Locale   string `json:"locale"`
}

type Account struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Type             string  `json:"type"`
	StartingBalance  float64 `json:"startingBalance"`
	Color            string  `json:"color"`
	IsDefault        bool    `json:"isDefault"`
	Balance          float64 `json:"balance"`
	TransactionCount int     `json:"transactionCount"`
}

type AccountInput struct {
	Name            string  `json:"name"`
	Type            string  `json:"type"`
	StartingBalance float64 `json:"startingBalance"`
	Color           string  `json:"color"`
	IsDefault       bool    `json:"isDefault"`
}

type Category struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

type CategoryInput struct {
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

type Merchant struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	DefaultCategoryID   string `json:"defaultCategoryId"`
	DefaultAccountID    string `json:"defaultAccountId"`
	DefaultCategoryName string `json:"defaultCategoryName"`
	UsageCount          int    `json:"usageCount"`
}

type MerchantInput struct {
	Name              string `json:"name"`
	DefaultCategoryID string `json:"defaultCategoryId"`
	DefaultAccountID  string `json:"defaultAccountId"`
}

type Transaction struct {
	ID              string  `json:"id"`
	Type            string  `json:"type"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	AmountBase      float64 `json:"amountBase"`
	ExchangeRate    float64 `json:"exchangeRate"`
	Date            string  `json:"date"`
	Notes           string  `json:"notes"`
	AccountID       string  `json:"accountId"`
	AccountName     string  `json:"accountName"`
	CategoryID      string  `json:"categoryId"`
	CategoryName    string  `json:"categoryName"`
	CategoryColor   string  `json:"categoryColor"`
	CategoryIcon    string  `json:"categoryIcon"`
	MerchantID      string  `json:"merchantId"`
	MerchantName    string  `json:"merchantName"`
	RecurringRuleID string  `json:"recurringRuleId"`
	TransferGroupID string  `json:"transferGroupId"`
	CreatedAt       string  `json:"createdAt"`
}

type TransactionInput struct {
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	AccountID    string  `json:"accountId"`
	CategoryID   string  `json:"categoryId"`
	Merchant     string  `json:"merchant"`
	Date         string  `json:"date"`
	Notes        string  `json:"notes"`
	TransferToID string  `json:"transferToId"`
}

type TransactionFilter struct {
	Month      string `json:"month"`
	Search     string `json:"search"`
	Type       string `json:"type"`
	CategoryID string `json:"categoryId"`
	AccountID  string `json:"accountId"`
	Limit      int    `json:"limit"`
}

type PlannedTransaction struct {
	ID                    string  `json:"id"`
	Name                  string  `json:"name"`
	Type                  string  `json:"type"`
	Amount                float64 `json:"amount"`
	CategoryID            string  `json:"categoryId"`
	CategoryName          string  `json:"categoryName"`
	CategoryColor         string  `json:"categoryColor"`
	CategoryIcon          string  `json:"categoryIcon"`
	AccountID             string  `json:"accountId"`
	AccountName           string  `json:"accountName"`
	Notes                 string  `json:"notes"`
	TargetMonth           string  `json:"targetMonth"`
	Installments          int     `json:"installments"`
	CompletedInstallments int     `json:"completedInstallments"`
	InstallmentAmount     float64 `json:"installmentAmount"`
	RemainingAmount       float64 `json:"remainingAmount"`
	NextMonth             string  `json:"nextMonth"`
	CreatedAt             string  `json:"createdAt"`
}

type PlannedInput struct {
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	CategoryID   string  `json:"categoryId"`
	AccountID    string  `json:"accountId"`
	Notes        string  `json:"notes"`
	TargetMonth  string  `json:"targetMonth"`
	Installments int     `json:"installments"`
}

type RecurringRule struct {
	ID                  string  `json:"id"`
	Type                string  `json:"type"`
	Amount              float64 `json:"amount"`
	Currency            string  `json:"currency"`
	AmountBase          float64 `json:"amountBase"`
	PaidThisMonth       float64 `json:"paidThisMonth"`
	DueThisMonth        float64 `json:"dueThisMonth"`
	TotalThisMonth      float64 `json:"totalThisMonth"`
	NextInstallmentAt   string  `json:"nextInstallmentAt"`
	AccountID           string  `json:"accountId"`
	AccountName         string  `json:"accountName"`
	TransferToAccountID string  `json:"transferToAccountId"`
	TransferToAccount   string  `json:"transferToAccountName"`
	IsTransfer          bool    `json:"isTransfer"`
	CategoryID          string  `json:"categoryId"`
	CategoryName        string  `json:"categoryName"`
	MerchantName        string  `json:"merchantName"`
	Label               string  `json:"label"`
	Unit                string  `json:"unit"`
	Interval            int     `json:"interval"`
	ByDay               int     `json:"byDay"`
	StartDate           string  `json:"startDate"`
	EndDate             string  `json:"endDate"`
	NextRunAt           string  `json:"nextRunAt"`
	Active              bool    `json:"active"`
}

type RecurringInput struct {
	Type                string  `json:"type"`
	Amount              float64 `json:"amount"`
	Currency            string  `json:"currency"`
	AccountID           string  `json:"accountId"`
	TransferToAccountID string  `json:"transferToAccountId"`
	CategoryID          string  `json:"categoryId"`
	Merchant            string  `json:"merchant"`
	Label               string  `json:"label"`
	Unit                string  `json:"unit"`
	Interval            int     `json:"interval"`
	ByDay               int     `json:"byDay"`
	StartDate           string  `json:"startDate"`
	EndDate             string  `json:"endDate"`
	Active              bool    `json:"active"`
}

type BudgetProgress struct {
	CategoryID    string  `json:"categoryId"`
	CategoryName  string  `json:"categoryName"`
	CategoryIcon  string  `json:"categoryIcon"`
	CategoryColor string  `json:"categoryColor"`
	Amount        float64 `json:"amount"`
	Spent         float64 `json:"spent"`
	Remaining     float64 `json:"remaining"`
	Progress      float64 `json:"progress"`
	Rollover      bool    `json:"rollover"`
	Allowance     float64 `json:"allowance"`
}

type BudgetInput struct {
	CategoryID string  `json:"categoryId"`
	Amount     float64 `json:"amount"`
	Rollover   bool    `json:"rollover"`
}

type DashboardTotals struct {
	Income      float64 `json:"income"`
	Expense     float64 `json:"expense"`
	Net         float64 `json:"net"`
	SavingsRate float64 `json:"savingsRate"`
}

type CashFlowPoint struct {
	Month   string  `json:"month"`
	Label   string  `json:"label"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

type CategorySlice struct {
	CategoryID string  `json:"categoryId"`
	Name       string  `json:"name"`
	Color      string  `json:"color"`
	Amount     float64 `json:"amount"`
	Share      float64 `json:"share"`
}

type TrendPoint struct {
	Day      int     `json:"day"`
	Current  float64 `json:"current"`
	Previous float64 `json:"previous"`
}

type UpcomingOccurrence struct {
	RuleID     string  `json:"ruleId"`
	Label      string  `json:"label"`
	Date       string  `json:"date"`
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	AmountBase float64 `json:"amountBase"`
	Type       string  `json:"type"`
}

type DashboardSummary struct {
	Month        string               `json:"month"`
	BaseCurrency string               `json:"baseCurrency"`
	Totals       DashboardTotals      `json:"totals"`
	PrevTotals   DashboardTotals      `json:"prevTotals"`
	CashFlow     []CashFlowPoint      `json:"cashFlow"`
	Categories   []CategorySlice      `json:"categories"`
	Budgets      []BudgetProgress     `json:"budgets"`
	Trend        []TrendPoint         `json:"trend"`
	Upcoming     []UpcomingOccurrence `json:"upcoming"`
	Accounts     []Account            `json:"accounts"`
	Recent       []Transaction        `json:"recent"`
}

type Bootstrap struct {
	Profile    Profile    `json:"profile"`
	Accounts   []Account  `json:"accounts"`
	Categories []Category `json:"categories"`
	Merchants  []Merchant `json:"merchants"`
	Rates      RateInfo   `json:"rates"`
	DBPath     string     `json:"dbPath"`
}

type RateInfo struct {
	BaseCurrency string             `json:"baseCurrency"`
	FetchedAt    string             `json:"fetchedAt"`
	Available    bool               `json:"available"`
	Overrides    []RateOverrideInfo `json:"overrides"`
}

type RateOverrideInfo struct {
	Currency string  `json:"currency"`
	Rate     float64 `json:"rate"`
}
