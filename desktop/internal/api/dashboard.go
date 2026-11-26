package api

import (
	"database/sql"
	"time"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

func (s *Service) ListBudgets(month string) ([]BudgetProgress, error) {
	rows, err := s.db().Query(`
		SELECT b.category_id, COALESCE(c.name, ''), COALESCE(c.icon, 'tag'), COALESCE(c.color, ''),
		       b.amount, b.rollover,
		       COALESCE((SELECT SUM(t.amount * COALESCE(t.exchange_rate, 1))
		                 FROM transactions t
		                 WHERE t.category_id = b.category_id AND t.type = 'expense'
		                   AND t.transfer_group_id IS NULL AND t.date LIKE ?), 0)
		FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
		ORDER BY c.name`, month+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []BudgetProgress{}
	for rows.Next() {
		var b BudgetProgress
		var amountCents, spentCents int64
		if err := rows.Scan(&b.CategoryID, &b.CategoryName, &b.CategoryIcon, &b.CategoryColor,
			&amountCents, &b.Rollover, &spentCents); err != nil {
			return nil, err
		}
		b.Amount = amount(amountCents)
		b.Spent = amount(spentCents)
		b.Allowance = b.Amount
		b.Remaining = round2(b.Allowance - b.Spent)
		if b.Allowance > 0 {
			b.Progress = b.Spent / b.Allowance
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (s *Service) SaveBudgets(items []BudgetInput) error {
	tx, err := s.db().(*sql.DB).Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM budgets`); err != nil {
		return err
	}
	for _, item := range items {
		if item.CategoryID == "" || item.Amount <= 0 {
			continue
		}
		if _, err := tx.Exec(`INSERT INTO budgets (category_id, amount, rollover) VALUES (?, ?, ?)`,
			item.CategoryID, cents(item.Amount), item.Rollover); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Service) GetDashboard(month string) (DashboardSummary, error) {
	profile, err := s.profile()
	if err != nil {
		return DashboardSummary{}, err
	}
	if month == "" {
		month = time.Now().Format("2006-01")
	}
	start := month + "-01"
	end := endOfMonth(month)
	prev := time.Date(parseDay(start).Year(), parseDay(start).Month(), 1, 0, 0, 0, 0, time.Local).AddDate(0, -1, 0)
	prevMonth := prev.Format("2006-01")
	prevStart := prevMonth + "-01"
	prevEnd := endOfMonth(prevMonth)

	totals, err := s.monthTotals(start, end)
	if err != nil {
		return DashboardSummary{}, err
	}
	prevTotals, err := s.monthTotals(prevStart, prevEnd)
	if err != nil {
		return DashboardSummary{}, err
	}

	cashFlow := []CashFlowPoint{}
	for i := 5; i >= 0; i-- {
		m := time.Date(parseDay(start).Year(), parseDay(start).Month(), 1, 0, 0, 0, 0, time.Local).AddDate(0, -i, 0)
		mKey := m.Format("2006-01")
		t, err := s.monthTotals(mKey+"-01", endOfMonth(mKey))
		if err != nil {
			return DashboardSummary{}, err
		}
		cashFlow = append(cashFlow, CashFlowPoint{
			Month: mKey, Label: m.Format("Jan 06"), Income: t.Income, Expense: t.Expense,
			Net: round2(t.Income - t.Expense),
		})
	}

	categories, err := s.categorySlices(start, end)
	if err != nil {
		return DashboardSummary{}, err
	}
	budgets, err := s.ListBudgets(month)
	if err != nil {
		return DashboardSummary{}, err
	}
	trend, err := s.trend(start, end, prevStart, prevEnd)
	if err != nil {
		return DashboardSummary{}, err
	}
	accounts, err := s.ListAccounts()
	if err != nil {
		return DashboardSummary{}, err
	}
	recent, err := s.ListTransactions(TransactionFilter{Limit: 8})
	if err != nil {
		return DashboardSummary{}, err
	}
	upcoming, err := s.upcoming(30)
	if err != nil {
		return DashboardSummary{}, err
	}

	summary := DashboardSummary{
		Month: month, BaseCurrency: profile.Currency, Totals: totals, PrevTotals: prevTotals,
		CashFlow: cashFlow, Categories: categories, Budgets: budgets, Trend: trend,
		Upcoming: upcoming, Accounts: accounts, Recent: recent,
	}
	return summary, nil
}

func (s *Service) monthTotals(start, end string) (DashboardTotals, error) {
	rows, err := s.db().Query(`SELECT type, SUM(amount * COALESCE(exchange_rate, 1)) FROM transactions
		WHERE date BETWEEN ? AND ? AND transfer_group_id IS NULL GROUP BY type`, start, end)
	if err != nil {
		return DashboardTotals{}, err
	}
	defer rows.Close()
	var t DashboardTotals
	for rows.Next() {
		var typ string
		var value float64
		if err := rows.Scan(&typ, &value); err != nil {
			return DashboardTotals{}, err
		}
		if typ == "income" {
			t.Income = round2(value / 100)
		} else {
			t.Expense = round2(value / 100)
		}
	}
	t.Net = round2(t.Income - t.Expense)
	if t.Income > 0 {
		t.SavingsRate = (t.Income - t.Expense) / t.Income
	}
	return t, rows.Err()
}

func (s *Service) categorySlices(start, end string) ([]CategorySlice, error) {
	rows, err := s.db().Query(`
		SELECT COALESCE(t.category_id, ''), COALESCE(c.name, 'Uncategorized'), COALESCE(c.color, ''),
		       SUM(t.amount * COALESCE(t.exchange_rate, 1))
		FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.type = 'expense' AND t.transfer_group_id IS NULL AND t.date BETWEEN ? AND ?
		GROUP BY t.category_id, c.name, c.color ORDER BY 4 DESC`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []CategorySlice{}
	var total float64
	for rows.Next() {
		var c CategorySlice
		if err := rows.Scan(&c.CategoryID, &c.Name, &c.Color, &c.Amount); err != nil {
			return nil, err
		}
		c.Amount = round2(c.Amount / 100)
		total += c.Amount
		result = append(result, c)
	}
	for i := range result {
		if total > 0 {
			result[i].Share = result[i].Amount / total
		}
	}
	return result, rows.Err()
}

func (s *Service) trend(start, end, prevStart, prevEnd string) ([]TrendPoint, error) {
	days := parseDay(end).Day()
	prevDays := parseDay(prevEnd).Day()
	current := make([]float64, days+1)
	previous := make([]float64, prevDays+1)
	rows, err := s.db().Query(`SELECT date, SUM(amount * COALESCE(exchange_rate, 1)) FROM transactions
		WHERE type = 'expense' AND transfer_group_id IS NULL AND date BETWEEN ? AND ? GROUP BY date`, start, end)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day string
		var value float64
		if err := rows.Scan(&day, &value); err != nil {
			rows.Close()
			return nil, err
		}
		if len(day) >= 10 {
			idx := int(day[8]-'0')*10 + int(day[9]-'0')
			if idx >= 1 && idx <= days {
				current[idx] += value
			}
		}
	}
	rows.Close()
	rows, err = s.db().Query(`SELECT date, SUM(amount * COALESCE(exchange_rate, 1)) FROM transactions
		WHERE type = 'expense' AND transfer_group_id IS NULL AND date BETWEEN ? AND ? GROUP BY date`, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var day string
		var value float64
		if err := rows.Scan(&day, &value); err != nil {
			rows.Close()
			return nil, err
		}
		if len(day) >= 10 {
			idx := int(day[8]-'0')*10 + int(day[9]-'0')
			if idx >= 1 && idx <= prevDays {
				previous[idx] += value
			}
		}
	}
	rows.Close()
	maxDay := max(days, prevDays)
	result := make([]TrendPoint, maxDay)
	for i := 1; i <= maxDay; i++ {
		cur, prev := 0.0, 0.0
		for j := 1; j <= min(i, days); j++ {
			cur += current[j]
		}
		for j := 1; j <= min(i, prevDays); j++ {
			prev += previous[j]
		}
		result[i-1] = TrendPoint{Day: i, Current: round2(cur / 100), Previous: round2(prev / 100)}
	}
	return result, nil
}

func (s *Service) upcoming(days int) ([]UpcomingOccurrence, error) {
	profile, err := s.profile()
	if err != nil {
		return nil, err
	}
	until := time.Now().AddDate(0, 0, days).Format("2006-01-02")
	today := store.Today()
	rows, err := s.db().Query(`SELECT id, type, amount, currency, COALESCE(label, ''), COALESCE(merchant_id, ''),
		COALESCE(category_id, ''), unit, interval, COALESCE(by_day, 0), next_run_at
		FROM recurring_rules WHERE active = 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []UpcomingOccurrence{}
	for rows.Next() {
		var id, typ, label, merchantID, categoryID, unit, next string
		var amountCents int64
		var currency string
		var interval, byDay int
		if err := rows.Scan(&id, &typ, &amountCents, &currency, &label, &merchantID, &categoryID, &unit, &interval, &byDay, &next); err != nil {
			return nil, err
		}
		start := firstOnOrAfter(next, today, unit, interval, byDay)
		displayLabel := label
		if displayLabel == "" && merchantID != "" {
			_ = s.db().QueryRow(`SELECT name FROM merchants WHERE id = ?`, merchantID).Scan(&displayLabel)
		}
		if displayLabel == "" && categoryID != "" {
			_ = s.db().QueryRow(`SELECT name FROM categories WHERE id = ?`, categoryID).Scan(&displayLabel)
		}
		if displayLabel == "" {
			displayLabel = "Recurring"
		}
		rate := s.rate(profile.Currency, currency)
		for _, date := range projectDates(start, until, unit, interval, byDay, 24) {
			result = append(result, UpcomingOccurrence{
				RuleID: id, Label: displayLabel, Date: date, Amount: amount(amountCents),
				Currency: currency, AmountBase: round2(amount(amountCents) * rate), Type: typ,
			})
		}
	}
	return result, rows.Err()
}
