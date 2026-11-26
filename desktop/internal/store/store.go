package store

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type Store struct {
	DB   *sql.DB
	Path string
}

const schema = `
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'You',
  email TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  starting_balance INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  default_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  exchange_rate REAL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  notes TEXT,
  transfer_group_id TEXT,
  recurring_rule_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id);

CREATE TABLE IF NOT EXISTS planned_transactions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount INTEGER NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  notes TEXT,
  target_month TEXT,
  installments INTEGER NOT NULL DEFAULT 1,
  completed_installments INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'expense',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  transfer_to_account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  merchant_id TEXT REFERENCES merchants(id) ON DELETE SET NULL,
  label TEXT,
  unit TEXT NOT NULL DEFAULT 'month',
  interval INTEGER NOT NULL DEFAULT 1,
  by_day INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recurring_due_idx ON recurring_rules(active, next_run_at);

CREATE TABLE IF NOT EXISTS budgets (
  category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  rollover INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_cache (
  base TEXT PRIMARY KEY,
  rates_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_overrides (
  currency TEXT PRIMARY KEY,
  rate REAL NOT NULL
);
`

func Open() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dataDir := filepath.Join(dir, "dot-expenses")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	return OpenAt(filepath.Join(dataDir, "dot-expenses.db"))
}

func OpenAt(path string) (*Store, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	dsn := "file:" + filepath.ToSlash(path) +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	if err := seed(db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{DB: db, Path: path}, nil
}

func seed(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT count(*) FROM profile`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		if _, err := db.Exec(`INSERT INTO profile (id, name, email, currency, locale) VALUES (1, 'You', '', 'USD', 'en')`); err != nil {
			return err
		}
	}
	if err := db.QueryRow(`SELECT count(*) FROM accounts`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		if _, err := db.Exec(`INSERT INTO accounts (id, name, type, starting_balance, color, is_default, created_at)
			VALUES (?, 'Cash', 'cash', 0, '#22c55e', 1, ?)`, NewID(), Now()); err != nil {
			return err
		}
	}
	if err := db.QueryRow(`SELECT count(*) FROM categories`).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		type seedCategory struct{ name, kind, icon, color string }
		seeds := []seedCategory{
			{"Groceries", "expense", "shopping-cart", "#22c55e"},
			{"Dining", "expense", "utensils", "#f97316"},
			{"Transport", "expense", "car", "#0ea5e9"},
			{"Housing", "expense", "home", "#8b5cf6"},
			{"Utilities", "expense", "zap", "#eab308"},
			{"Health", "expense", "heart-pulse", "#ec4899"},
			{"Entertainment", "expense", "clapperboard", "#d946ef"},
			{"Shopping", "expense", "shopping-bag", "#64748b"},
			{"Subscriptions", "expense", "repeat", "#6366f1"},
			{"Travel", "expense", "plane", "#14b8a6"},
			{"Other", "expense", "tag", "#94a3b8"},
			{"Salary", "income", "briefcase", "#22c55e"},
			{"Freelance", "income", "laptop", "#0ea5e9"},
			{"Investments", "income", "trending-up", "#8b5cf6"},
			{"Gifts", "income", "gift", "#ec4899"},
		}
		for _, c := range seeds {
			if _, err := db.Exec(`INSERT INTO categories (id, name, kind, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
				NewID(), c.name, c.kind, c.icon, c.color, Now()); err != nil {
				return err
			}
		}
	}
	return nil
}
