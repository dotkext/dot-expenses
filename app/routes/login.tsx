import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams, useRouteLoaderData } from "react-router";

import { useI18n } from "@/components/i18n-provider";
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
import { Separator } from "@/components/ui/separator";
import { apiPost, ApiError } from "@/lib/api";
import type { TranslationKey } from "@/lib/i18n/core";
import type { RootLoaderData } from "@/lib/types";
import { loginSchema } from "@/lib/validation";
import { useUiStore } from "@/stores/ui";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const root = useRouteLoaderData("root") as RootLoaderData | undefined;
  const showSplash = useUiStore((state) => state.showSplash);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const googleError = searchParams.get("error") === "google";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      setError(issue ? t(issue as TranslationKey) : t("errors.invalidInput"));
      return;
    }
    setPending(true);
    try {
      await apiPost("/api/auth/login", parsed.data);
      showSplash();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.failed"));
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (googleError) setError(t("auth.googleFailed"));
  }, [googleError, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.welcomeBack")}</CardTitle>
        <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder={t("auth.loginPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} aria-busy={pending} className="disabled:opacity-100">
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                {t("auth.signingIn")}
              </>
            ) : (
              t("auth.signIn")
            )}
          </Button>
        </form>

        {root?.googleAuthEnabled && (
          <>
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
              <Separator className="flex-1" />
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href="/auth/google">
                <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.14 10 5.32 0 9.24-3.65 9.24-9.09 0-1.13-.15-1.81-.15-1.81Z"
                  />
                </svg>
                {t("auth.continueGoogle")}
              </a>
            </Button>
          </>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="ml-1 font-medium text-foreground hover:underline">
          {t("auth.register")}
        </Link>
      </CardFooter>
    </Card>
  );
}
