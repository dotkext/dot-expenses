package api

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

type ruleRow struct {
	ID                  string
	Type                string
	Amount              int64
	Currency            string
	AccountID           string
	TransferToAccountID string
	CategoryID          string
	MerchantID          string
	Label               string
	Unit                string
	Interval            int
	ByDay               int
	StartDate           string
	EndDate             string
	NextRunAt           string
	Active              bool
}

func (s *Service) ListRecurring() ([]RecurringRule, error) {
	profile, err := s.profile()
	if err != nil {
		return nil, err
	}
	rows, err := s.db().Query(`
		SELECT r.id, r.type, r.amount, r.currency, COALESCE(r.account_id, ''), COALESCE(r.transfer_to_account_id, ''),
		       COALESCE(r.category_id, ''), COALESCE(r.merchant_id, ''), COALESCE(r.label, ''),
		       r.unit, r.interval, COALESCE(r.by_day, 0), r.start_date, COALESCE(r.end_date, ''),
		       r.next_run_at, r.active
		FROM recurring_rules r ORDER BY r.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rules := []ruleRow{}
	for rows.Next() {
		var r ruleRow
		if err := rows.Scan(&r.ID, &r.Type, &r.Amount, &r.Currency, &r.AccountID, &r.TransferToAccountID,
			&r.CategoryID, &r.MerchantID, &r.Label, &r.Unit, &r.Interval, &r.ByDay,
			&r.StartDate, &r.EndDate, &r.NextRunAt, &r.Active); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	today := store.Today()
	month := store.CurrentMonth()
	monthStart := month + "-01"
	monthEnd := endOfMonth(month)
	paid := map[string]float64{}
	payRows, err := s.db().Query(`SELECT COALESCE(recurring_rule_id, ''), type, amount, COALESCE(exchange_rate, 1)
		FROM transactions WHERE recurring_rule_id IS NOT NULL AND date LIKE ?`, month+"%")
	if err != nil {
		return nil, err
	}
	for payRows.Next() {
		var ruleID, typ string
		var amountCents int64
		var rate float64
		if err := payRows.Scan(&ruleID, &typ, &amountCents, &rate); err != nil {
			payRows.Close()
			return nil, err
		}
		paid[ruleID+":"+typ] += amount(amountCents) * rate
	}
	payRows.Close()

	result := []RecurringRule{}
	for _, r := range rules {
		base := s.rate(profile.Currency, r.Currency)
		payType := r.Type
		if r.TransferToAccountID != "" {
			payType = "expense"
		}
		paidAmount := round2(paid[r.ID+":"+payType])
		due := 0.0
		if r.Active {
			next := firstOnOrAfter(r.NextRunAt, monthStart, r.Unit, r.Interval, r.ByDay)
			count := len(projectDates(next, monthEnd, r.Unit, r.Interval, r.ByDay, 40))
			due = round2(float64(count) * amount(r.Amount) * base)
		}
		nextAt := r.NextRunAt
		if r.Active {
			nextAt = firstOnOrAfter(r.NextRunAt, today, r.Unit, r.Interval, r.ByDay)
		}
		var accountName, transferName, categoryName, merchantName string
		_ = s.db().QueryRow(`SELECT COALESCE(name, '') FROM accounts WHERE id = ?`, r.AccountID).Scan(&accountName)
		if r.TransferToAccountID != "" {
			_ = s.db().QueryRow(`SELECT COALESCE(name, '') FROM accounts WHERE id = ?`, r.TransferToAccountID).Scan(&transferName)
		}
		if r.CategoryID != "" {
			_ = s.db().QueryRow(`SELECT COALESCE(name, '') FROM categories WHERE id = ?`, r.CategoryID).Scan(&categoryName)
		}
		if r.MerchantID != "" {
			_ = s.db().QueryRow(`SELECT COALESCE(name, '') FROM merchants WHERE id = ?`, r.MerchantID).Scan(&merchantName)
		}
		result = append(result, RecurringRule{
			ID: r.ID, Type: r.Type, Amount: amount(r.Amount), Currency: r.Currency,
			AmountBase: round2(amount(r.Amount) * base), PaidThisMonth: paidAmount,
			DueThisMonth: due, TotalThisMonth: round2(paidAmount + due), NextInstallmentAt: nextAt,
			AccountID: r.AccountID, AccountName: accountName,
			TransferToAccountID: r.TransferToAccountID, TransferToAccount: transferName,
			IsTransfer: r.TransferToAccountID != "", CategoryID: r.CategoryID, CategoryName: categoryName,
			MerchantName: merchantName, Label: r.Label, Unit: r.Unit, Interval: r.Interval,
			ByDay: r.ByDay, StartDate: r.StartDate, EndDate: r.EndDate, NextRunAt: r.NextRunAt, Active: r.Active,
		})
	}
	sort.SliceStable(result, func(i, j int) bool {
		return strings.ToLower(recurringSortName(result[i])) < strings.ToLower(recurringSortName(result[j]))
	})
	return result, nil
}

// recurringSortName is the name shown in the list. Sorting by it keeps the
// order A–Z even when a rule is paused or resumed.
func recurringSortName(rule RecurringRule) string {
	if rule.Label != "" {
		return rule.Label
	}
	if rule.TransferToAccount != "" {
		return rule.TransferToAccount
	}
	if rule.MerchantName != "" {
		return rule.MerchantName
	}
	if rule.CategoryName != "" {
		return rule.CategoryName
	}
	return rule.Type
}

func (s *Service) CreateRecurring(input RecurringInput) (RecurringRule, error) {
	profile, err := s.profile()
	if err != nil {
		return RecurringRule{}, err
	}
	if input.Amount <= 0 {
		return RecurringRule{}, fmt.Errorf("amount must be greater than zero")
	}
	if input.Currency == "" {
		input.Currency = profile.Currency
	}
	if input.Unit == "" {
		input.Unit = "month"
	}
	if input.Interval < 1 {
		input.Interval = 1
	}
	if input.StartDate == "" {
		input.StartDate = store.Today()
	}
	if input.Active == false {
		// new rules are active by default; explicit false still respected below
	}
	merchantID := ""
	if input.TransferToAccountID == "" {
		merchantID, _ = s.resolveMerchant(input.Merchant, input.CategoryID, input.AccountID)
	}
	next := firstOnOrAfter(input.StartDate, store.Today(), input.Unit, input.Interval, input.ByDay)
	id := store.NewID()
	now := store.Now()
	_, err = s.db().Exec(`INSERT INTO recurring_rules
		(id, type, amount, currency, account_id, transfer_to_account_id, category_id, merchant_id, label,
		 unit, interval, by_day, start_date, end_date, next_run_at, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.Type, cents(input.Amount), input.Currency, nullString(input.AccountID),
		nullString(input.TransferToAccountID), nullString(input.CategoryID), nullString(merchantID),
		nullString(input.Label), input.Unit, input.Interval, nullInt(input.ByDay),
		input.StartDate, nullString(input.EndDate), next, input.Active, now, now)
	if err != nil {
		return RecurringRule{}, err
	}
	return s.getRecurring(id)
}

func (s *Service) UpdateRecurring(id string, input RecurringInput) (RecurringRule, error) {
	if input.Amount <= 0 {
		return RecurringRule{}, fmt.Errorf("amount must be greater than zero")
	}
	if input.Unit == "" {
		input.Unit = "month"
	}
	if input.Interval < 1 {
		input.Interval = 1
	}
	merchantID := ""
	if input.TransferToAccountID == "" {
		merchantID, _ = s.resolveMerchant(input.Merchant, input.CategoryID, input.AccountID)
	}
	next := firstOnOrAfter(input.StartDate, store.Today(), input.Unit, input.Interval, input.ByDay)
	_, err := s.db().Exec(`UPDATE recurring_rules SET type = ?, amount = ?, currency = ?, account_id = ?,
		transfer_to_account_id = ?, category_id = ?, merchant_id = ?, label = ?, unit = ?, interval = ?,
		by_day = ?, start_date = ?, end_date = ?, next_run_at = ?, active = ?, updated_at = ? WHERE id = ?`,
		input.Type, cents(input.Amount), input.Currency, nullString(input.AccountID),
		nullString(input.TransferToAccountID), nullString(input.CategoryID), nullString(merchantID),
		nullString(input.Label), input.Unit, input.Interval, nullInt(input.ByDay),
		input.StartDate, nullString(input.EndDate), next, input.Active, store.Now(), id)
	if err != nil {
		return RecurringRule{}, err
	}
	if err := s.rebuildRecurring(id); err != nil {
		return RecurringRule{}, err
	}
	return s.getRecurring(id)
}

func (s *Service) DeleteRecurring(id string) error {
	_, err := s.db().Exec(`DELETE FROM recurring_rules WHERE id = ?`, id)
	return err
}

func (s *Service) SetRecurringActive(id string, active bool) error {
	_, err := s.db().Exec(`UPDATE recurring_rules SET active = ?, updated_at = ? WHERE id = ?`, active, store.Now(), id)
	return err
}

func (s *Service) RunRecurringNow(id string) error {
	rule, err := s.loadRule(id)
	if err != nil {
		return err
	}
	if err := s.materialize(rule, store.Today()); err != nil {
		return err
	}
	scheduled := firstOnOrAfter(rule.NextRunAt, store.Today(), rule.Unit, rule.Interval, rule.ByDay)
	next := advanceDate(scheduled, rule.Unit, rule.Interval, rule.ByDay)
	if rule.EndDate != "" && next > rule.EndDate {
		_, err = s.db().Exec(`UPDATE recurring_rules SET next_run_at = ?, active = 0, updated_at = ? WHERE id = ?`, next, store.Now(), id)
	} else {
		_, err = s.db().Exec(`UPDATE recurring_rules SET next_run_at = ?, updated_at = ? WHERE id = ?`, next, store.Now(), id)
	}
	return err
}

func (s *Service) RecalculateRecurring(id string) error {
	return s.rebuildRecurring(id)
}

func (s *Service) RecalculateAllRecurring() error {
	rows, err := s.db().Query(`SELECT id FROM recurring_rules`)
	if err != nil {
		return err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	for _, id := range ids {
		if err := s.rebuildRecurring(id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) RunDueRecurring() error {
	today := store.Today()
	rows, err := s.db().Query(`SELECT id FROM recurring_rules WHERE active = 1 AND next_run_at <= ?`, today)
	if err != nil {
		return err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	for _, id := range ids {
		rule, err := s.loadRule(id)
		if err != nil {
			continue
		}
		next := rule.NextRunAt
		for next <= today {
			if rule.EndDate != "" && next > rule.EndDate {
				break
			}
			if err := s.materialize(rule, next); err != nil {
				break
			}
			next = advanceDate(next, rule.Unit, rule.Interval, rule.ByDay)
		}
		ended := rule.EndDate != "" && next > rule.EndDate
		_, _ = s.db().Exec(`UPDATE recurring_rules SET next_run_at = ?, active = ?, updated_at = ? WHERE id = ?`,
			next, !ended, store.Now(), id)
	}
	return nil
}

func (s *Service) rebuildRecurring(id string) error {
	rule, err := s.loadRule(id)
	if err != nil {
		return err
	}
	if _, err := s.db().Exec(`DELETE FROM transactions WHERE recurring_rule_id = ?`, id); err != nil {
		return err
	}
	today := store.Today()
	until := today
	if rule.EndDate != "" && rule.EndDate < today {
		until = rule.EndDate
	}
	if rule.StartDate > until {
		_, err := s.db().Exec(`UPDATE recurring_rules SET next_run_at = ?, updated_at = ? WHERE id = ?`, rule.StartDate, store.Now(), id)
		return err
	}
	dates := projectDates(rule.StartDate, until, rule.Unit, rule.Interval, rule.ByDay, 400)
	for _, date := range dates {
		if err := s.materialize(rule, date); err != nil {
			return err
		}
	}
	next := rule.StartDate
	if len(dates) > 0 {
		next = advanceDate(dates[len(dates)-1], rule.Unit, rule.Interval, rule.ByDay)
	}
	ended := rule.EndDate != "" && next > rule.EndDate
	active := rule.Active && !ended
	_, err = s.db().Exec(`UPDATE recurring_rules SET next_run_at = ?, active = ?, updated_at = ? WHERE id = ?`,
		next, active, store.Now(), id)
	return err
}

func (s *Service) loadRule(id string) (ruleRow, error) {
	var r ruleRow
	err := s.db().QueryRow(`SELECT id, type, amount, currency, COALESCE(account_id, ''), COALESCE(transfer_to_account_id, ''),
		COALESCE(category_id, ''), COALESCE(merchant_id, ''), COALESCE(label, ''), unit, interval,
		COALESCE(by_day, 0), start_date, COALESCE(end_date, ''), next_run_at, active
		FROM recurring_rules WHERE id = ?`, id).
		Scan(&r.ID, &r.Type, &r.Amount, &r.Currency, &r.AccountID, &r.TransferToAccountID,
			&r.CategoryID, &r.MerchantID, &r.Label, &r.Unit, &r.Interval, &r.ByDay,
			&r.StartDate, &r.EndDate, &r.NextRunAt, &r.Active)
	if err == sql.ErrNoRows {
		return ruleRow{}, fmt.Errorf("recurring rule not found")
	}
	return r, err
}

func (s *Service) materialize(rule ruleRow, date string) error {
	profile, err := s.profile()
	if err != nil {
		return err
	}
	rate := s.rate(profile.Currency, rule.Currency)
	group := ""
	if rule.TransferToAccountID != "" {
		group = store.NewID()
	}
	insert := func(typ, accountID string) error {
		_, err := s.db().Exec(`INSERT INTO transactions
			(id, type, amount, currency, exchange_rate, account_id, category_id, merchant_id, date, notes, transfer_group_id, recurring_rule_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			store.NewID(), typ, rule.Amount, rule.Currency, rate, nullString(accountID),
			nullString(rule.CategoryID), nullString(rule.MerchantID), date, nullString(rule.Label),
			nullString(group), rule.ID, store.Now())
		return err
	}
	if err := insert(rule.Type, rule.AccountID); err != nil {
		return err
	}
	if rule.TransferToAccountID != "" {
		return insert("income", rule.TransferToAccountID)
	}
	return nil
}

func (s *Service) getRecurring(id string) (RecurringRule, error) {
	list, err := s.ListRecurring()
	if err != nil {
		return RecurringRule{}, err
	}
	for _, r := range list {
		if r.ID == id {
			return r, nil
		}
	}
	return RecurringRule{}, fmt.Errorf("recurring rule not found")
}

/* date helpers */

func parseDay(value string) time.Time {
	t, _ := time.Parse("2006-01-02", value)
	return t
}

func dayString(t time.Time) string { return t.Format("2006-01-02") }

func endOfMonth(month string) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month + "-31"
	}
	return dayString(t.AddDate(0, 1, 0).AddDate(0, 0, -1))
}

func advanceDate(from, unit string, interval, byDay int) string {
	if interval < 1 {
		interval = 1
	}
	d := parseDay(from)
	switch unit {
	case "day":
		d = d.AddDate(0, 0, interval)
	case "week":
		d = d.AddDate(0, 0, interval*7)
		if byDay >= 0 && byDay <= 6 {
			delta := (byDay - int(d.Weekday()) + 7) % 7
			d = d.AddDate(0, 0, delta)
		}
	case "year":
		d = d.AddDate(interval, 0, 0)
	default:
		day := byDay
		if day < 1 {
			day = d.Day()
		}
		base := time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, time.Local)
		first := base.AddDate(0, interval, 0)
		last := first.AddDate(0, 1, 0).AddDate(0, 0, -1).Day()
		if day > last {
			day = last
		}
		d = time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.Local)
	}
	return dayString(d)
}

func firstOnOrAfter(from, target, unit string, interval, byDay int) string {
	current := from
	for i := 0; i < 2000 && current < target; i++ {
		current = advanceDate(current, unit, interval, byDay)
	}
	return current
}

func projectDates(from, until, unit string, interval, byDay, capCount int) []string {
	if capCount <= 0 {
		capCount = 40
	}
	dates := []string{}
	current := from
	for i := 0; i < capCount && current <= until; i++ {
		dates = append(dates, current)
		current = advanceDate(current, unit, interval, byDay)
	}
	return dates
}

func nullInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}
