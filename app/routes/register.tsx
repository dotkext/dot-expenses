import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useRevalidator } from "react-router";

import { useI18n } from "@/components/i18n-provider";
import { CurrencySelect } from "@/components/features/currency-select";
import { LanguageSelect } from "@/components/features/language-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { apiPost, ApiError } from "@/lib/api";
import { setLocaleCookie } from "@/lib/i18n/client";
import type { Locale, TranslationKey } from "@/lib/i18n/core";
import { registerSchema } from "@/lib/validation";
import { useUiStore } from "@/stores/ui";

export default function Register() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const showSplash = useUiStore((state) => state.showSplash);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    currency: "USD",
    locale,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Keep the form's language in sync when the floating picker on the auth
  // layout changes the active locale.
  useEffect(() => {
    setForm((prev) => (prev.locale === locale ? prev : { ...prev, locale }));
  }, [locale]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function changeLocale(next: Locale) {
    set("locale", next);
    setLocaleCookie(next);
    // Re-run the root loader so the whole auth screen switches language.
    void revalidator.revalidate();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setError(issue ? t(issue as TranslationKey) : t("errors.invalidInput"));
      return;
    }
    setPending(true);
    try {
      await apiPost("/api/auth/register", parsed.data);
      setLocaleCookie(parsed.data.locale);
      showSplash();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.createTitle")}</CardTitle>
        <CardDescription>{t("auth.createSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("common.name")}</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder={t("auth.namePlaceholder")}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPlaceholder")}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="locale">{t("common.language")}</Label>
            <LanguageSelect id="locale" value={form.locale} onChange={changeLocale} />
            <p className="text-xs text-muted-foreground">{t("auth.languageHelp")}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currency">{t("common.currency")}</Label>
            <CurrencySelect value={form.currency} onChange={(code) => set("currency", code)} />
            <p className="text-xs text-muted-foreground">{t("auth.currencyHelp")}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} aria-busy={pending} className="disabled:opacity-100">
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                {t("auth.creating")}
              </>
            ) : (
              t("auth.createAccount")
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t("auth.alreadyRegistered")}{" "}
        <Link to="/login" className="ml-1 font-medium text-foreground hover:underline">
          {t("auth.signIn")}
        </Link>
      </CardFooter>
    </Card>
  );
}
