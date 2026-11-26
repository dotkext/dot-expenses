package api

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

const transactionSelect = `
SELECT t.id, t.type, t.amount, t.currency, COALESCE(t.exchange_rate, 1), t.date, COALESCE(t.notes, ''),
       COALESCE(t.account_id, ''), COALESCE(a.name, ''),
       COALESCE(t.category_id, ''), COALESCE(c.name, ''), COALESCE(c.color, ''), COALESCE(c.icon, ''),
       COALESCE(t.merchant_id, ''), COALESCE(m.name, ''),
       COALESCE(t.recurring_rule_id, ''), COALESCE(t.transfer_group_id, ''), t.created_at
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN merchants m ON m.id = t.merchant_id`

func scanTransaction(scanner interface{ Scan(...any) error }) (Transaction, error) {
	var t Transaction
	var centsAmount int64
	var rate float64
	err := scanner.Scan(
		&t.ID, &t.Type, &centsAmount, &t.Currency, &rate, &t.Date, &t.Notes,
		&t.AccountID, &t.AccountName,
		&t.CategoryID, &t.CategoryName, &t.CategoryColor, &t.CategoryIcon,
		&t.MerchantID, &t.MerchantName,
		&t.RecurringRuleID, &t.TransferGroupID, &t.CreatedAt,
	)
	if err != nil {
		return Transaction{}, err
	}
	t.Amount = amount(centsAmount)
	t.ExchangeRate = rate
	t.AmountBase = round2(t.Amount * rate)
	return t, nil
}

func (s *Service) ListTransactions(filter TransactionFilter) ([]Transaction, error) {
	where := []string{"1 = 1"}
	args := []any{}
	if filter.Month != "" {
		where = append(where, "t.date LIKE ?")
		args = append(args, filter.Month+"%")
	}
	if filter.Search != "" {
		where = append(where, "(lower(COALESCE(t.notes, '')) LIKE ? OR lower(COALESCE(m.name, '')) LIKE ? OR lower(COALESCE(c.name, '')) LIKE ?)")
		q := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		args = append(args, q, q, q)
	}
	if filter.Type == "expense" || filter.Type == "income" {
		where = append(where, "t.type = ?")
		args = append(args, filter.Type)
	}
	if filter.CategoryID != "" {
		where = append(where, "t.category_id = ?")
		args = append(args, filter.CategoryID)
	}
	if filter.AccountID != "" {
		where = append(where, "t.account_id = ?")
		args = append(args, filter.AccountID)
	}
	limit := filter.Limit
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	args = append(args, limit)
	rows, err := s.db().Query(transactionSelect+" WHERE "+strings.Join(where, " AND ")+
		" ORDER BY t.date DESC, t.created_at DESC LIMIT ?", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Transaction{}
	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

func (s *Service) GetTransaction(id string) (Transaction, error) {
	row := s.db().QueryRow(transactionSelect+` WHERE t.id = ?`, id)
	t, err := scanTransaction(row)
	if err == sql.ErrNoRows {
		return Transaction{}, fmt.Errorf("transaction not found")
	}
	return t, err
}

func (s *Service) CreateTransaction(input TransactionInput) (Transaction, error) {
	if input.Amount <= 0 {
		return Transaction{}, fmt.Errorf("amount must be greater than zero")
	}
	profile, err := s.profile()
	if err != nil {
		return Transaction{}, err
	}
	if input.Type != "income" {
		input.Type = "expense"
	}
	if input.Currency == "" {
		input.Currency = profile.Currency
	}
	if input.Date == "" {
		input.Date = store.Today()
	}
	rate := s.rate(profile.Currency, input.Currency)
	id := store.NewID()
	now := store.Now()

	if input.TransferToID != "" {
		if input.TransferToID == input.AccountID {
			return Transaction{}, fmt.Errorf("choose two different accounts")
		}
		if input.AccountID == "" {
			return Transaction{}, fmt.Errorf("choose a source account")
		}
		group := store.NewID()
		notes := input.Notes
		if notes == "" {
			notes = "Transfer"
		}
		if _, err := s.db().Exec(`INSERT INTO transactions
			(id, type, amount, currency, exchange_rate, account_id, category_id, merchant_id, date, notes, transfer_group_id, created_at)
			VALUES (?, 'expense', ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
			store.NewID(), cents(input.Amount), input.Currency, rate, input.AccountID, input.Date, notes, group, now); err != nil {
			return Transaction{}, err
		}
		destinationID := store.NewID()
		if _, err := s.db().Exec(`INSERT INTO transactions
			(id, type, amount, currency, exchange_rate, account_id, category_id, merchant_id, date, notes, transfer_group_id, created_at)
			VALUES (?, 'income', ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
			destinationID, cents(input.Amount), input.Currency, rate, input.TransferToID, input.Date, notes, group, now); err != nil {
			return Transaction{}, err
		}
		return s.GetTransaction(destinationID)
	}

	merchantID, err := s.resolveMerchant(input.Merchant, input.CategoryID, input.AccountID)
	if err != nil {
		return Transaction{}, err
	}
	_, err = s.db().Exec(`INSERT INTO transactions
		(id, type, amount, currency, exchange_rate, account_id, category_id, merchant_id, date, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.Type, cents(input.Amount), input.Currency, rate,
		nullString(input.AccountID), nullString(input.CategoryID), nullString(merchantID),
		input.Date, nullString(input.Notes), now)
	if err != nil {
		return Transaction{}, err
	}
	return s.GetTransaction(id)
}

func (s *Service) UpdateTransaction(id string, input TransactionInput) (Transaction, error) {
	if input.Amount <= 0 {
		return Transaction{}, fmt.Errorf("amount must be greater than zero")
	}
	profile, err := s.profile()
	if err != nil {
		return Transaction{}, err
	}
	if input.Type != "income" {
		input.Type = "expense"
	}
	if input.Currency == "" {
		input.Currency = profile.Currency
	}
	if input.Date == "" {
		input.Date = store.Today()
	}
	rate := s.rate(profile.Currency, input.Currency)
	merchantID, err := s.resolveMerchant(input.Merchant, input.CategoryID, input.AccountID)
	if err != nil {
		return Transaction{}, err
	}
	res, err := s.db().Exec(`UPDATE transactions SET type = ?, amount = ?, currency = ?, exchange_rate = ?,
		account_id = ?, category_id = ?, merchant_id = ?, date = ?, notes = ? WHERE id = ?`,
		input.Type, cents(input.Amount), input.Currency, rate,
		nullString(input.AccountID), nullString(input.CategoryID), nullString(merchantID),
		input.Date, nullString(input.Notes), id)
	if err != nil {
		return Transaction{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Transaction{}, fmt.Errorf("transaction not found")
	}
	return s.GetTransaction(id)
}

func (s *Service) DeleteTransaction(id string) error {
	var group string
	_ = s.db().QueryRow(`SELECT COALESCE(transfer_group_id, '') FROM transactions WHERE id = ?`, id).Scan(&group)
	if group != "" {
		_, err := s.db().Exec(`DELETE FROM transactions WHERE transfer_group_id = ?`, group)
		return err
	}
	_, err := s.db().Exec(`DELETE FROM transactions WHERE id = ?`, id)
	return err
}

func (s *Service) DuplicateTransaction(id string) (Transaction, error) {
	original, err := s.GetTransaction(id)
	if err != nil {
		return Transaction{}, err
	}
	return s.CreateTransaction(TransactionInput{
		Type: original.Type, Amount: original.Amount, Currency: original.Currency,
		AccountID: original.AccountID, CategoryID: original.CategoryID,
		Merchant: original.MerchantName, Date: original.Date, Notes: original.Notes,
	})
}
