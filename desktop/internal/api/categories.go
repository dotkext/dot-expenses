package api

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

func (s *Service) ListCategories() ([]Category, error) {
	rows, err := s.db().Query(`SELECT id, name, kind, icon, COALESCE(color, '') FROM categories ORDER BY kind, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Kind, &c.Icon, &c.Color); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func (s *Service) CreateCategory(input CategoryInput) (Category, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Category{}, fmt.Errorf("name is required")
	}
	if input.Kind != "income" {
		input.Kind = "expense"
	}
	if input.Icon == "" {
		input.Icon = "tag"
	}
	id := store.NewID()
	_, err := s.db().Exec(`INSERT INTO categories (id, name, kind, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, strings.TrimSpace(input.Name), input.Kind, input.Icon, nullString(input.Color), store.Now())
	if err != nil {
		return Category{}, err
	}
	return Category{ID: id, Name: strings.TrimSpace(input.Name), Kind: input.Kind, Icon: input.Icon, Color: input.Color}, nil
}

func (s *Service) UpdateCategory(id string, input CategoryInput) (Category, error) {
	if strings.TrimSpace(input.Name) == "" {
		return Category{}, fmt.Errorf("name is required")
	}
	if input.Kind != "income" {
		input.Kind = "expense"
	}
	if input.Icon == "" {
		input.Icon = "tag"
	}
	res, err := s.db().Exec(`UPDATE categories SET name = ?, kind = ?, icon = ?, color = ? WHERE id = ?`,
		strings.TrimSpace(input.Name), input.Kind, input.Icon, nullString(input.Color), id)
	if err != nil {
		return Category{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Category{}, fmt.Errorf("category not found")
	}
	return Category{ID: id, Name: strings.TrimSpace(input.Name), Kind: input.Kind, Icon: input.Icon, Color: input.Color}, nil
}

func (s *Service) DeleteCategory(id string) error {
	_, err := s.db().Exec(`DELETE FROM categories WHERE id = ?`, id)
	return err
}

func (s *Service) ListMerchants() ([]Merchant, error) {
	rows, err := s.db().Query(`
		SELECT m.id, m.name, COALESCE(m.default_category_id, ''), COALESCE(m.default_account_id, ''),
		       COALESCE(c.name, ''), m.usage_count
		FROM merchants m LEFT JOIN categories c ON c.id = m.default_category_id
		ORDER BY m.usage_count DESC, m.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Merchant{}
	for rows.Next() {
		var m Merchant
		if err := rows.Scan(&m.ID, &m.Name, &m.DefaultCategoryID, &m.DefaultAccountID, &m.DefaultCategoryName, &m.UsageCount); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func (s *Service) CreateMerchant(input MerchantInput) (Merchant, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return Merchant{}, fmt.Errorf("name is required")
	}
	var existing string
	err := s.db().QueryRow(`SELECT id FROM merchants WHERE lower(name) = lower(?)`, name).Scan(&existing)
	if err == nil {
		return Merchant{}, fmt.Errorf("a store with this name already exists")
	}
	if err != sql.ErrNoRows {
		return Merchant{}, err
	}
	id := store.NewID()
	_, err = s.db().Exec(`INSERT INTO merchants (id, name, default_category_id, default_account_id, usage_count, last_used_at, created_at)
		VALUES (?, ?, ?, ?, 0, ?, ?)`, id, name, nullString(input.DefaultCategoryID), nullString(input.DefaultAccountID), store.Now(), store.Now())
	if err != nil {
		return Merchant{}, err
	}
	return s.getMerchant(id)
}

func (s *Service) UpdateMerchant(id string, input MerchantInput) (Merchant, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return Merchant{}, fmt.Errorf("name is required")
	}
	res, err := s.db().Exec(`UPDATE merchants SET name = ?, default_category_id = ?, default_account_id = ? WHERE id = ?`,
		name, nullString(input.DefaultCategoryID), nullString(input.DefaultAccountID), id)
	if err != nil {
		return Merchant{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Merchant{}, fmt.Errorf("merchant not found")
	}
	return s.getMerchant(id)
}

func (s *Service) DeleteMerchant(id string) error {
	_, err := s.db().Exec(`DELETE FROM merchants WHERE id = ?`, id)
	return err
}

func (s *Service) getMerchant(id string) (Merchant, error) {
	list, err := s.ListMerchants()
	if err != nil {
		return Merchant{}, err
	}
	for _, m := range list {
		if m.ID == id {
			return m, nil
		}
	}
	return Merchant{}, sql.ErrNoRows
}

func (s *Service) resolveMerchant(name, categoryID, accountID string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", nil
	}
	var id string
	var usage int
	err := s.db().QueryRow(`SELECT id, usage_count FROM merchants WHERE lower(name) = lower(?)`, name).
		Scan(&id, &usage)
	if err == sql.ErrNoRows {
		id = store.NewID()
		_, err = s.db().Exec(`INSERT INTO merchants (id, name, default_category_id, default_account_id, usage_count, last_used_at, created_at)
			VALUES (?, ?, ?, ?, 1, ?, ?)`, id, name, nullString(categoryID), nullString(accountID), store.Now(), store.Now())
		return id, err
	}
	if err != nil {
		return "", err
	}
	_, err = s.db().Exec(`UPDATE merchants SET usage_count = ?, last_used_at = ?,
		default_category_id = COALESCE(?, default_category_id),
		default_account_id = COALESCE(?, default_account_id) WHERE id = ?`,
		usage+1, store.Now(), nullString(categoryID), nullString(accountID), id)
	return id, err
}
