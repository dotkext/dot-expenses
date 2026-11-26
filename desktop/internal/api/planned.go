package api

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

func addMonths(month string, n int) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month
	}
	return t.AddDate(0, n, 0).Format("2006-01")
}

const plannedSelect = `
SELECT p.id, p.name, p.type, p.amount, COALESCE(p.category_id, ''), COALESCE(c.name, ''),
       COALESCE(c.color, ''), COALESCE(c.icon, ''), COALESCE(p.account_id, ''), COALESCE(a.name, ''),
       COALESCE(p.notes, ''), COALESCE(p.target_month, ''), p.installments, p.completed_installments, p.created_at
FROM planned_transactions p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN accounts a ON a.id = p.account_id`

func scanPlanned(scanner interface{ Scan(...any) error }) (PlannedTransaction, error) {
	var p PlannedTransaction
	var total int64
	err := scanner.Scan(
		&p.ID, &p.Name, &p.Type, &total, &p.CategoryID, &p.CategoryName,
		&p.CategoryColor, &p.CategoryIcon, &p.AccountID, &p.AccountName,
		&p.Notes, &p.TargetMonth, &p.Installments, &p.CompletedInstallments, &p.CreatedAt,
	)
	if err != nil {
		return PlannedTransaction{}, err
	}
	p.Amount = amount(total)
	per := round2(p.Amount / float64(max(p.Installments, 1)))
	p.InstallmentAmount = per
	p.RemainingAmount = round2(p.Amount - per*float64(p.CompletedInstallments))
	if p.TargetMonth != "" && p.CompletedInstallments < p.Installments {
		p.NextMonth = addMonths(p.TargetMonth, p.CompletedInstallments)
	}
	return p, nil
}

func (s *Service) ListPlanned() ([]PlannedTransaction, error) {
	rows, err := s.db().Query(plannedSelect + ` ORDER BY p.target_month IS NULL, p.target_month, p.created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []PlannedTransaction{}
	for rows.Next() {
		p, err := scanPlanned(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (s *Service) CreatePlanned(input PlannedInput) (PlannedTransaction, error) {
	if strings.TrimSpace(input.Name) == "" {
		return PlannedTransaction{}, fmt.Errorf("name is required")
	}
	if input.Amount <= 0 {
		return PlannedTransaction{}, fmt.Errorf("amount must be greater than zero")
	}
	if input.Installments < 1 {
		input.Installments = 1
	}
	if input.Type != "income" {
		input.Type = "expense"
	}
	id := store.NewID()
	now := store.Now()
	_, err := s.db().Exec(`INSERT INTO planned_transactions
		(id, name, type, amount, category_id, account_id, notes, target_month, installments, completed_installments, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
		id, strings.TrimSpace(input.Name), input.Type, cents(input.Amount),
		nullString(input.CategoryID), nullString(input.AccountID), nullString(input.Notes),
		nullString(input.TargetMonth), input.Installments, now, now)
	if err != nil {
		return PlannedTransaction{}, err
	}
	return s.getPlanned(id)
}

func (s *Service) UpdatePlanned(id string, input PlannedInput) (PlannedTransaction, error) {
	if strings.TrimSpace(input.Name) == "" {
		return PlannedTransaction{}, fmt.Errorf("name is required")
	}
	if input.Amount <= 0 {
		return PlannedTransaction{}, fmt.Errorf("amount must be greater than zero")
	}
	if input.Installments < 1 {
		input.Installments = 1
	}
	existing, err := s.getPlanned(id)
	if err != nil {
		return PlannedTransaction{}, err
	}
	completed := min(existing.CompletedInstallments, input.Installments-1)
	_, err = s.db().Exec(`UPDATE planned_transactions SET name = ?, type = ?, amount = ?, category_id = ?,
		account_id = ?, notes = ?, target_month = ?, installments = ?, completed_installments = ?, updated_at = ? WHERE id = ?`,
		strings.TrimSpace(input.Name), input.Type, cents(input.Amount),
		nullString(input.CategoryID), nullString(input.AccountID), nullString(input.Notes),
		nullString(input.TargetMonth), input.Installments, completed, store.Now(), id)
	if err != nil {
		return PlannedTransaction{}, err
	}
	return s.getPlanned(id)
}

func (s *Service) DeletePlanned(id string) error {
	_, err := s.db().Exec(`DELETE FROM planned_transactions WHERE id = ?`, id)
	return err
}

func (s *Service) RecordPlannedInstallment(id string) (Transaction, error) {
	p, err := s.getPlanned(id)
	if err != nil {
		return Transaction{}, err
	}
	per := round2(p.Amount / float64(max(p.Installments, 1)))
	nextCount := p.CompletedInstallments + 1
	isLast := nextCount >= p.Installments
	due := per
	if isLast {
		due = round2(p.Amount - per*float64(p.CompletedInstallments))
	}
	tx, err := s.CreateTransaction(TransactionInput{
		Type: p.Type, Amount: due, AccountID: p.AccountID, CategoryID: p.CategoryID,
		Date: store.Today(), Notes: strings.TrimSpace(p.Name + " — " + p.Notes),
	})
	if err != nil {
		return Transaction{}, err
	}
	if isLast {
		_, err = s.db().Exec(`DELETE FROM planned_transactions WHERE id = ?`, id)
	} else {
		_, err = s.db().Exec(`UPDATE planned_transactions SET completed_installments = ?, updated_at = ? WHERE id = ?`,
			nextCount, store.Now(), id)
	}
	return tx, err
}

func (s *Service) getPlanned(id string) (PlannedTransaction, error) {
	row := s.db().QueryRow(plannedSelect+` WHERE p.id = ?`, id)
	p, err := scanPlanned(row)
	if err == sql.ErrNoRows {
		return PlannedTransaction{}, fmt.Errorf("planned transaction not found")
	}
	return p, err
}
