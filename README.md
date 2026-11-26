# dot-expenses

A self-hosted, minimalist expense tracker: budgets, recurring income and
expenses, multi-currency support and a customizable dashboard.

![stack](https://img.shields.io/badge/React_Router-SSR-black) ![stack](https://img.shields.io/badge/PostgreSQL-external-blue) ![stack](https://img.shields.io/badge/docker--compose-ready-blue)

## Features

- **Quick add** — press `n` or `⌘K` anywhere to record an expense or payment.
  Stores/merchants are remembered with their category and account, so the form
  pre-fills itself over time.
- **Dashboard** — movable, resizable widgets (react-grid-layout) with charts
  (Recharts): cash flow, category breakdown, spending trend, budgets, upcoming
  recurring payments, account balances. Layout syncs across devices.
- **Recurring engine** — daily/weekly/monthly/yearly rules materialize
  transactions automatically (cron inside the app + catch-up on boot), including
  transfers between accounts (e.g. a monthly savings transfer). The page shows
  this month's total, already paid and still due from the current date, plus the
  next installment and a 30-day forward projection that never touches the ledger.
- **Planned transactions** — keep things you intend to pay or receive without a
  concrete date, optionally spread over monthly installments; recording one
  turns it into a real transaction.
- **Budgets** — monthly per-category limits with optional rollover.
- **Accounts** — bank, cards, cash and wallets with computed balances.
- **Multi-currency** — per-user base currency; foreign transactions are
  converted with ECB daily reference rates (via [frankfurter.dev](https://frankfurter.dev),
  no API key) or your manual overrides. Rates are snapshotted per transaction
  so historical reports never drift.
- **Auth** — email + password (argon2id, database-backed sessions) and
  optional Google sign-in that only activates when configured.
- **Languages** — English, Spanish, German, Romanian and French UI. The preference is stored per
  user (`users.locale`) and applied to money, numbers, dates and charts; the
  `dotexpenses_locale` cookie carries it on the sign-in screens.
- **Export** — CSV / JSON of everything you own.

## Quick start (docker compose)

```bash
git clone https://github.com/dotkext/dot-expenses.git && cd dot-expenses
docker compose up -d
```

The app applies database migrations on boot and starts serving on
`http://localhost:3000`. Register the first account at `/register` and you're
done.

`docker-compose.yml` bundles PostgreSQL 17 with a named volume. Point
`DATABASE_URL` at any external Postgres instead if you prefer — the bundled
database is optional (it is only bound to `127.0.0.1`).

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/dot_expenses` | Connection string. **Required in production.** |
| `PORT` | `3000` | HTTP port. |
| `APP_URL` | *(request origin)* | Public origin, e.g. `https://expenses.example.com`. Needed for Google OAuth redirects. |
| `TZ` | `UTC` | Timezone for "today" and recurring schedules (IANA name, e.g. `Europe/Madrid`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Set **both** to enable Google sign-in. Redirect URI: `{APP_URL}/auth/google/callback`. |
| `CRON_SECRET` | — | When set, `POST /api/cron/run` (with `Authorization: Bearer <secret>`) runs the recurring engine + rate refresh for external schedulers. The in-process scheduler runs regardless. |
| `EXCHANGE_RATES_DISABLED` | `false` | `true` for offline installs: no automatic rate fetching; manual overrides still work. |
| `AUTO_MIGRATE` | `true` | Set `false` to run `drizzle-kit migrate` yourself. |

## Development

Requirements: Node 22+, pnpm, a PostgreSQL instance (the compose file provides
one).

```bash
docker compose up -d postgres   # local database on 127.0.0.1:5432
pnpm install
pnpm exec drizzle-kit generate  # only needed after schema changes
pnpm dev                        # http://localhost:5173
```

The dev server migrates and seeds on boot, so `DATABASE_URL` is the only
setup step.

```bash
pnpm build      # production build (build/)
pnpm start      # serve the production build (react-router-serve)
pnpm typecheck  # react-router typegen + tsc
pnpm db:push    # push schema changes directly (dev shortcut)
pnpm db:studio  # drizzle studio
```

### Architecture notes

- **React Router v8 framework mode** (the current major of React Router v7's
  framework release): SSR, file-based routes, loaders prefetch data
  server-side; TanStack Query handles client-side fetching/caching after
  hydration with the loader data as `initialData`.
- **API** — `/api/*` resource routes return plain JSON (`{ error }` on
  failures) so the client fetch helpers stay simple. Mutations are
  origin-checked; session cookies are `HttpOnly` + `SameSite=Lax`.
- **Domain services** live in `app/server/*.service.ts`; shared types in
  `app/lib/types.ts` are `import type`-only on the client.
- **Money** — `numeric(14,2)` in Postgres, string over the wire, aggregates
  computed in SQL with the per-transaction rate snapshot
  (`amount * exchange_rate`).
- **Recurring** — `recurring_rules.next_run_at` is advanced with month-end
  clamping (Jan 31 → Feb 28) by the cron in `app/server/bootstrap.ts`, which
  also refreshes exchange rates twice a day.
- **i18n** — a small typed dictionary module (`app/lib/i18n/`), not i18next.
  The dictionary keys are compile-time checked; the locale is resolved in the
  root loader (user preference → cookie → `Accept-Language`) and shared through
  React context, so the server and client render the same markup. Validation
  messages and API `{ error }` values are translation keys that the client
  localizes.

## Backups

The usual Postgres story:

```bash
docker exec dot-expenses-postgres-1 pg_dump -U postgres dot_expenses > backup.sql
```

## License

[AGPL-3.0-only](LICENSE) — you can use, modify and self-host this software,
including commercially. If you run a modified version as a network service,
you must offer the corresponding source under the same license.
