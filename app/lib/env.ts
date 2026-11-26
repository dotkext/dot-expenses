/**
 * Runtime environment configuration.
 *
 * Everything is optional except DATABASE_URL so the app boots with sensible
 * defaults; optional features (Google OAuth, external cron) activate only when
 * their environment variables are present.
 */

function str(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  databaseUrl: str("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dot_expenses")!,
  /** Public origin of the app, used for OAuth redirects (falls back to the request origin). */
  appUrl: str("APP_URL"),
  googleClientId: str("GOOGLE_CLIENT_ID"),
  googleClientSecret: str("GOOGLE_CLIENT_SECRET"),
  /** When set, POST /api/cron/run requires this secret via the Authorization header. */
  cronSecret: str("CRON_SECRET"),
  /** Set to true for offline installs: no automatic exchange-rate fetching. */
  exchangeRatesDisabled: bool("EXCHANGE_RATES_DISABLED", false),
  /** Run database migrations automatically at boot (default true). */
  autoMigrate: bool("AUTO_MIGRATE", true),
};

/** Google sign-in is only offered when both credentials are configured. */
export const googleAuthEnabled = Boolean(env.googleClientId && env.googleClientSecret);
