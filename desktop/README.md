# dot-expenses desktop

Native desktop build of dot-expenses built with **Wails v3**, **Go** and
**SQLite**. The window is frameless with an in-app title bar, custom window
controls and rounded corners on platforms that support them.

## Requirements

- Go 1.24+
- Node.js 20+ and pnpm
- Wails v3 CLI (`wails3`)
- WebView2 runtime on Windows (included with Windows 11)

## Development

```bash
cd desktop
wails3 dev
```

## Production build

```bash
cd desktop
wails3 build
```

The executable is written to `desktop/bin/`.

## Data

The app stores everything locally in SQLite:

- Windows: `%APPDATA%\dot-expenses\dot-expenses.db`
- macOS: `~/Library/Application Support/dot-expenses/dot-expenses.db`
- Linux: `~/.local/share/dot-expenses/dot-expenses.db`

The database is created and seeded on first launch.

## Features

- Dashboard with monthly totals, cash flow, categories, recent activity and
  account balances
- Transactions with categories, accounts, stores and account-to-account
  transfers
- Accounts with starting balances, colors and default account
- Planned transactions with optional month and monthly installments
- Recurring rules, including savings/transfer rules, run-now and recalculate
- Monthly budgets per category
- Categories, profile, language, base currency and exchange-rate overrides
- English, Spanish, German, Romanian and French UI
- Geist Sans / Geist Mono typography, light/dark/system theme

The web app also includes Google sign-in, CSV/JSON import/export, and movable
dashboard widgets. Those are not part of the desktop build yet.

## Debugging

Set `DOT_DEBUG=1` before launching the executable to enable WebView2 remote
debugging on `http://127.0.0.1:9222`.

## License

[AGPL-3.0-only](../LICENSE)
