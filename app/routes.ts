import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Auth pages (redirect to / when already signed in)
  layout("routes/auth-layout.tsx", [
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
  ]),

  // Google OAuth (only functional when env vars are set)
  route("auth/google", "routes/auth.google.ts"),
  route("auth/google/callback", "routes/auth.google.callback.ts"),

  // App shell (requires a session)
  layout("routes/app-shell.tsx", [
    index("routes/dashboard.tsx"),
    route("transactions", "routes/transactions.tsx"),
    route("planned", "routes/planned.tsx"),
    route("recurring", "routes/recurring.tsx"),
    route("budgets", "routes/budgets.tsx"),
    route("accounts", "routes/accounts.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),

  // JSON API
  ...prefix("api", [
    route("auth/register", "routes/api/auth-register.ts"),
    route("auth/login", "routes/api/auth-login.ts"),
    route("auth/logout", "routes/api/auth-logout.ts"),
    route("auth/password", "routes/api/auth-password.ts"),
    route("auth/account", "routes/api/auth-account.ts"),
    route("auth/sessions", "routes/api/auth-sessions.ts"),
    route("auth/google/unlink", "routes/api/auth-google-unlink.ts"),
    route("profile", "routes/api/profile.ts"),
    route("transactions", "routes/api/transactions.ts"),
    route("transactions/:id", "routes/api/transaction-detail.ts"),
    route("transactions/:id/duplicate", "routes/api/transaction-duplicate.ts"),
    route("planned", "routes/api/planned.ts"),
    route("planned/:id", "routes/api/planned-detail.ts"),
    route("planned/:id/record", "routes/api/planned-record.ts"),
    route("recurring", "routes/api/recurring.ts"),
    route("recurring/recalculate", "routes/api/recurring-recalculate.ts"),
    route("recurring/:id", "routes/api/recurring-detail.ts"),
    route("recurring/:id/recalculate", "routes/api/recurring-recalculate-detail.ts"),
    route("recurring/:id/run", "routes/api/recurring-run.ts"),
    route("budgets", "routes/api/budgets.ts"),
    route("accounts", "routes/api/accounts.ts"),
    route("accounts/:id", "routes/api/account-detail.ts"),
    route("categories", "routes/api/categories.ts"),
    route("categories/:id", "routes/api/category-detail.ts"),
    route("merchants", "routes/api/merchants.ts"),
    route("merchants/:id", "routes/api/merchant-detail.ts"),
    route("dashboard/layout", "routes/api/dashboard-layout.ts"),
    route("dashboard/summary", "routes/api/dashboard-summary.ts"),
    route("rates", "routes/api/rates.ts"),
    route("export", "routes/api/export.ts"),
    route("cron/run", "routes/api/cron-run.ts"),
  ]),
] satisfies RouteConfig;
