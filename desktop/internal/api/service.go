package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/dotkext/dot-expenses/desktop/internal/store"
)

type Service struct {
	Store *store.Store
}

func NewService(s *store.Store) *Service {
	return &Service{Store: s}
}

type q interface {
	QueryRow(string, ...any) *sql.Row
	Query(string, ...any) (*sql.Rows, error)
	Exec(string, ...any) (sql.Result, error)
}

func (s *Service) db() q { return s.Store.DB }

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func cents(v float64) int64  { return int64(math.Round(v * 100)) }
func amount(v int64) float64 { return float64(v) / 100 }

func nullString(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func (s *Service) profile() (Profile, error) {
	var p Profile
	err := s.db().QueryRow(`SELECT name, email, currency, locale FROM profile WHERE id = 1`).
		Scan(&p.Name, &p.Email, &p.Currency, &p.Locale)
	return p, err
}

func (s *Service) GetProfile() (Profile, error) { return s.profile() }

func (s *Service) UpdateProfile(p Profile) (Profile, error) {
	if strings.TrimSpace(p.Name) == "" {
		p.Name = "You"
	}
	if p.Currency == "" {
		p.Currency = "USD"
	}
	if p.Locale == "" {
		p.Locale = "en"
	}
	_, err := s.db().Exec(
		`UPDATE profile SET name = ?, email = ?, currency = ?, locale = ? WHERE id = 1`,
		strings.TrimSpace(p.Name), strings.TrimSpace(p.Email), p.Currency, p.Locale,
	)
	if err != nil {
		return Profile{}, err
	}
	return s.profile()
}

/* ---------------------------------------------------------------- */
/* Exchange rates                                                    */
/* ---------------------------------------------------------------- */

const frankfurterURL = "https://api.frankfurter.dev/v1/latest?base=EUR"

func (s *Service) RefreshRates() (RateInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Get(frankfurterURL)
	if err != nil {
		return s.GetRates()
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return s.GetRates()
	}
	var payload struct {
		Rates map[string]float64 `json:"rates"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return s.GetRates()
	}
	payload.Rates["EUR"] = 1
	encoded, err := json.Marshal(payload.Rates)
	if err != nil {
		return RateInfo{}, err
	}
	_, err = s.db().Exec(
		`INSERT INTO rate_cache (base, rates_json, fetched_at) VALUES ('EUR', ?, ?)
		 ON CONFLICT(base) DO UPDATE SET rates_json = excluded.rates_json, fetched_at = excluded.fetched_at`,
		string(encoded), store.Now(),
	)
	if err != nil {
		return RateInfo{}, err
	}
	return s.GetRates()
}

func (s *Service) readRates() (map[string]float64, string, bool, error) {
	var raw, fetched string
	err := s.db().QueryRow(`SELECT rates_json, fetched_at FROM rate_cache WHERE base = 'EUR'`).
		Scan(&raw, &fetched)
	if err == sql.ErrNoRows {
		return map[string]float64{"EUR": 1}, "", false, nil
	}
	if err != nil {
		return nil, "", false, err
	}
	var rates map[string]float64
	if err := json.Unmarshal([]byte(raw), &rates); err != nil {
		return map[string]float64{"EUR": 1}, fetched, false, nil
	}
	if rates == nil {
		rates = map[string]float64{}
	}
	rates["EUR"] = 1
	return rates, fetched, true, nil
}

func (s *Service) GetRates() (RateInfo, error) {
	profile, err := s.profile()
	if err != nil {
		return RateInfo{}, err
	}
	_, fetched, available, _ := s.readRates()
	rows, err := s.db().Query(`SELECT currency, rate FROM rate_overrides ORDER BY currency`)
	if err != nil {
		return RateInfo{}, err
	}
	defer rows.Close()
	info := RateInfo{BaseCurrency: profile.Currency, FetchedAt: fetched, Available: available, Overrides: []RateOverrideInfo{}}
	for rows.Next() {
		var o RateOverrideInfo
		if err := rows.Scan(&o.Currency, &o.Rate); err != nil {
			return RateInfo{}, err
		}
		info.Overrides = append(info.Overrides, o)
	}
	return info, nil
}

func (s *Service) rate(base, from string) float64 {
	if from == base {
		return 1
	}
	var override float64
	if err := s.db().QueryRow(`SELECT rate FROM rate_overrides WHERE currency = ?`, from).
		Scan(&override); err == nil && override > 0 {
		return override
	}
	rates, _, _, _ := s.readRates()
	rf, okFrom := rates[from]
	rb, okBase := rates[base]
	if okFrom && okBase && rf > 0 {
		return rb / rf
	}
	return 1
}

func (s *Service) SaveRateOverride(o RateOverrideInfo) error {
	if o.Rate <= 0 {
		return fmt.Errorf("rate must be greater than zero")
	}
	_, err := s.db().Exec(
		`INSERT INTO rate_overrides (currency, rate) VALUES (?, ?)
		 ON CONFLICT(currency) DO UPDATE SET rate = excluded.rate`,
		strings.ToUpper(o.Currency), o.Rate,
	)
	return err
}

func (s *Service) DeleteRateOverride(currency string) error {
	_, err := s.db().Exec(`DELETE FROM rate_overrides WHERE currency = ?`, currency)
	return err
}

func (s *Service) Bootstrap() (Bootstrap, error) {
	profile, err := s.profile()
	if err != nil {
		return Bootstrap{}, err
	}
	accounts, err := s.ListAccounts()
	if err != nil {
		return Bootstrap{}, err
	}
	categories, err := s.ListCategories()
	if err != nil {
		return Bootstrap{}, err
	}
	merchants, err := s.ListMerchants()
	if err != nil {
		return Bootstrap{}, err
	}
	rates, err := s.GetRates()
	if err != nil {
		return Bootstrap{}, err
	}
	return Bootstrap{
		Profile: profile, Accounts: accounts, Categories: categories,
		Merchants: merchants, Rates: rates, DBPath: s.Store.Path,
	}, nil
}
