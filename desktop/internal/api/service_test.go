package api

import (
	"path/filepath"
	"testing"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

func newService(t *testing.T) *Service {
	t.Helper()
	s, err := store.OpenAt(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.DB.Close() })
	return NewService(s)
}

func TestAccountsTransactionsAndDashboard(t *testing.T) {
	svc := newService(t)
	boot, err := svc.Bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if len(boot.Accounts) == 0 || len(boot.Categories) == 0 {
		t.Fatal("expected seeded accounts and categories")
	}
	cash := boot.Accounts[0]
	savings, err := svc.CreateAccount(AccountInput{Name: "Savings", Type: "cash", StartingBalance: 0})
	if err != nil {
		t.Fatal(err)
	}
	expenseCategory := ""
	incomeCategory := ""
	for _, c := range boot.Categories {
		if c.Kind == "expense" && expenseCategory == "" {
			expenseCategory = c.ID
		}
		if c.Kind == "income" {
			incomeCategory = c.ID
		}
	}
	if _, err := svc.CreateTransaction(TransactionInput{
		Type: "expense", Amount: 100, Currency: "USD", AccountID: cash.ID,
		CategoryID: expenseCategory, Merchant: "Test Store", Date: store.Today(),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateTransaction(TransactionInput{
		Type: "income", Amount: 500, Currency: "USD", AccountID: cash.ID,
		CategoryID: incomeCategory, Date: store.Today(),
	}); err != nil {
		t.Fatal(err)
	}

	month := store.CurrentMonth()
	summary, err := svc.GetDashboard(month)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Totals.Income != 500 || summary.Totals.Expense != 100 || summary.Totals.Net != 400 {
		t.Fatalf("unexpected totals: %+v", summary.Totals)
	}

	// Transfer should move balances but not income/expense totals.
	if _, err := svc.CreateTransaction(TransactionInput{
		Type: "expense", Amount: 50, Currency: "USD", AccountID: cash.ID,
		Date: store.Today(), TransferToID: savings.ID,
	}); err != nil {
		t.Fatal(err)
	}
	summary, err = svc.GetDashboard(month)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Totals.Expense != 100 {
		t.Fatalf("transfer leaked into expenses: %+v", summary.Totals)
	}
	accounts, err := svc.ListAccounts()
	if err != nil {
		t.Fatal(err)
	}
	var cashBalance, savingsBalance float64
	for _, a := range accounts {
		if a.ID == cash.ID {
			cashBalance = a.Balance
		}
		if a.ID == savings.ID {
			savingsBalance = a.Balance
		}
	}
	if cashBalance != 350 || savingsBalance != 50 {
		t.Fatalf("unexpected balances: cash=%v savings=%v", cashBalance, savingsBalance)
	}
}

func TestPlannedInstallments(t *testing.T) {
	svc := newService(t)
	boot, _ := svc.Bootstrap()
	plan, err := svc.CreatePlanned(PlannedInput{
		Name: "Laptop", Type: "expense", Amount: 300,
		AccountID: boot.Accounts[0].ID, TargetMonth: store.CurrentMonth(), Installments: 3,
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.InstallmentAmount != 100 || plan.RemainingAmount != 300 {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	if _, err := svc.RecordPlannedInstallment(plan.ID); err != nil {
		t.Fatal(err)
	}
	plans, _ := svc.ListPlanned()
	if len(plans) != 1 || plans[0].RemainingAmount != 200 || plans[0].CompletedInstallments != 1 {
		t.Fatalf("unexpected after first installment: %+v", plans)
	}
	if _, err := svc.RecordPlannedInstallment(plan.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.RecordPlannedInstallment(plan.ID); err != nil {
		t.Fatal(err)
	}
	plans, _ = svc.ListPlanned()
	if len(plans) != 0 {
		t.Fatalf("plan should be complete, got %+v", plans)
	}
}

func TestRecurringTransfer(t *testing.T) {
	svc := newService(t)
	boot, _ := svc.Bootstrap()
	cash := boot.Accounts[0]
	savings, err := svc.CreateAccount(AccountInput{Name: "Savings", Type: "cash", StartingBalance: 0})
	if err != nil {
		t.Fatal(err)
	}
	rule, err := svc.CreateRecurring(RecurringInput{
		Type: "expense", Amount: 100, Currency: "USD",
		AccountID: cash.ID, TransferToAccountID: savings.ID, Label: "Savings transfer",
		Unit: "month", Interval: 1, StartDate: store.Today(), Active: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.RunRecurringNow(rule.ID); err != nil {
		t.Fatal(err)
	}
	accounts, _ := svc.ListAccounts()
	var cashBalance, savingsBalance float64
	for _, a := range accounts {
		switch a.ID {
		case cash.ID:
			cashBalance = a.Balance
		case savings.ID:
			savingsBalance = a.Balance
		}
	}
	if cashBalance != -100 || savingsBalance != 100 {
		t.Fatalf("transfer balances: cash=%v savings=%v", cashBalance, savingsBalance)
	}
	summary, err := svc.GetDashboard(store.CurrentMonth())
	if err != nil {
		t.Fatal(err)
	}
	if summary.Totals.Income != 0 || summary.Totals.Expense != 0 {
		t.Fatalf("transfer leaked into dashboard totals: %+v", summary.Totals)
	}
}

func TestRecurringRunAndRecalculate(t *testing.T) {
	svc := newService(t)
	boot, _ := svc.Bootstrap()
	rule, err := svc.CreateRecurring(RecurringInput{
		Type: "expense", Amount: 20, Currency: "USD",
		AccountID: boot.Accounts[0].ID, Label: "Test rule",
		Unit: "month", Interval: 1, StartDate: store.Today(), Active: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if rule.NextInstallmentAt != store.Today() {
		t.Fatalf("expected next installment today, got %s", rule.NextInstallmentAt)
	}
	if err := svc.RunRecurringNow(rule.ID); err != nil {
		t.Fatal(err)
	}
	rules, _ := svc.ListRecurring()
	if len(rules) != 1 || rules[0].PaidThisMonth != 20 {
		t.Fatalf("unexpected rule after run: %+v", rules)
	}
	if err := svc.RecalculateRecurring(rule.ID); err != nil {
		t.Fatal(err)
	}
	rules, _ = svc.ListRecurring()
	if len(rules) != 1 || rules[0].PaidThisMonth != 20 {
		t.Fatalf("recalculate should keep one paid installment, got %+v", rules)
	}
}
