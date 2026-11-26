package api

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

func (s *Service) ListAccounts() ([]Account, error) {
	rows, err := s.db().Query(`
		SELECT a.id, a.name, a.type, a.starting_balance, COALESCE(a.color, ''), a.is_default,
		  a.starting_balance + COALESCE((
		    SELECT SUM(t.amount * COALESCE(t.exchange_rate, 1))
		    FROM transactions t WHERE t.account_id = a.id AND t.type = 'income'
		  ), 0) - COALESCE((
		    SELECT SUM(t.amount * COALESCE(t.exchange_rate, 1))
		    FROM transactions t WHERE t.account_id = a.id AND t.type = 'expense'
		  ), 0),
		  (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id)
		FROM accounts a ORDER BY a.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Account{}
	for rows.Next() {
		var a Account
		var starting, balance int64
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &starting, &a.Color, &a.IsDefault, &balance, &a.TransactionCount); err != nil {
			return nil, err
		}
		a.StartingBalance = amount(starting)
		a.Balance = amount(balance)
		result = append(result, a)
	}
	return result, rows.Err()
}

func (s *Service) CreateAccount(input AccountInput) (Account, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Account{}, fmt.Errorf("name is required")
	}
	if input.Type == "" {
		input.Type = "bank"
	}
	if input.IsDefault {
		if _, err := s.db().Exec(`UPDATE accounts SET is_default = 0`); err != nil {
			return Account{}, err
		}
	}
	id := store.NewID()
	_, err := s.db().Exec(`INSERT INTO accounts (id, name, type, starting_balance, color, is_default, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, strings.TrimSpace(input.Name), input.Type, cents(input.StartingBalance),
		nullString(input.Color), input.IsDefault, store.Now())
	if err != nil {
		return Account{}, err
	}
	return s.getAccount(id)
}

func (s *Service) UpdateAccount(id string, input AccountInput) (Account, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Account{}, fmt.Errorf("name is required")
	}
	if input.IsDefault {
		if _, err := s.db().Exec(`UPDATE accounts SET is_default = 0`); err != nil {
			return Account{}, err
		}
	}
	res, err := s.db().Exec(`UPDATE accounts SET name = ?, type = ?, starting_balance = ?, color = ?, is_default = ?
		WHERE id = ?`, strings.TrimSpace(input.Name), input.Type, cents(input.StartingBalance),
		nullString(input.Color), input.IsDefault, id)
	if err != nil {
		return Account{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Account{}, fmt.Errorf("account not found")
	}
	return s.getAccount(id)
}

func (s *Service) DeleteAccount(id, moveTo string, cascade bool) error {
	var count int
	if err := s.db().QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = ?`, id).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		switch {
		case moveTo != "":
			if _, err := s.db().Exec(`UPDATE transactions SET account_id = ? WHERE account_id = ?`, moveTo, id); err != nil {
				return err
			}
		case cascade:
			if _, err := s.db().Exec(`DELETE FROM transactions WHERE account_id = ?`, id); err != nil {
				return err
			}
		default:
			return fmt.Errorf("account has %d transaction(s)", count)
		}
	}
	if _, err := s.db().Exec(`DELETE FROM accounts WHERE id = ?`, id); err != nil {
		return err
	}
	var remaining int
	_ = s.db().QueryRow(`SELECT COUNT(*) FROM accounts WHERE is_default = 1`).Scan(&remaining)
	if remaining == 0 {
		_, _ = s.db().Exec(`UPDATE accounts SET is_default = 1
			WHERE id = (SELECT id FROM accounts ORDER BY created_at LIMIT 1)`)
	}
	return nil
}

func (s *Service) getAccount(id string) (Account, error) {
	list, err := s.ListAccounts()
	if err != nil {
		return Account{}, err
	}
	for _, a := range list {
		if a.ID == id {
			return a, nil
		}
	}
	return Account{}, sql.ErrNoRows
}
