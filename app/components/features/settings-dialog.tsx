import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRevalidator, useRouteLoaderData } from "react-router";
import {
  Check,
  Database,
  Download,
  Link2,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  Unlink,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { CategoryIcon, CATEGORY_ICON_NAMES } from "@/components/features/category-icon";
import { CurrencySelect } from "@/components/features/currency-select";
import { LanguageSelect } from "@/components/features/language-select";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  ApiError,
} from "@/lib/api";
import { setLocaleCookie } from "@/lib/i18n/client";
import type { Locale, TranslationKey } from "@/lib/i18n/core";
import { qk } from "@/lib/query-keys";
import { storeTheme } from "@/lib/theme";
import type { CategoryDTO, RateInfo, RootLoaderData, UserDTO } from "@/lib/types";
import { profileSchema } from "@/lib/validation";
import { useUiStore } from "@/stores/ui";

type Section = "profile" | "categories" | "rates" | "data";

const SECTIONS = [
  { id: "profile", icon: UserRound, key: "settings.tabProfile" },
  { id: "categories", icon: Tags, key: "settings.tabCategories" },
  { id: "rates", icon: RefreshCw, key: "settings.tabRates" },
  { id: "data", icon: Database, key: "settings.tabData" },
] as const;

export function SettingsDialog({ user }: { user: UserDTO }) {
  const { t } = useI18n();
  const { settingsOpen, closeSettings } = useUiStore();
  const root = useRouteLoaderData("root") as RootLoaderData | undefined;
  const googleEnabled = root?.googleAuthEnabled ?? false;
  const [section, setSection] = useState<Section>("profile");

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(open) => {
        if (open) setSection("profile");
        else closeSettings();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex h-[min(75vh,680px)] min-h-[460px]">
          <aside className="w-40 shrink-0 border-r bg-muted/20 p-3 sm:w-52">
            <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("settings.title")}
            </p>
            <nav className="grid gap-1" aria-label={t("settings.title")}>
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                      section === item.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{t(item.key)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {section === "profile" && (
              <ProfileTab user={user} googleEnabled={googleEnabled} />
            )}
            {section === "categories" && <CategoriesTab />}
            {section === "rates" && <RatesTab baseCurrency={user.currency} />}
            {section === "data" && <DataTab user={user} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfileTab({ user, googleEnabled }: { user: UserDTO; googleEnabled: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    currency: user.currency,
    locale: user.locale,
  });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  async function refresh() {
    await Promise.all([queryClient.invalidateQueries(), revalidator.revalidate()]);
  }

  const profileMutation = useMutation({
    mutationFn: () => {
      const parsed = profileSchema.safeParse(form);
      if (!parsed.success) {
        const issue = parsed.error.issues[0]?.message;
        throw new ApiError(issue ? t(issue as TranslationKey) : t("errors.invalidInput"), 400);
      }
      return apiPatch("/api/profile", parsed.data).then(() => parsed.data);
    },
    onSuccess: async (data) => {
      setLocaleCookie(data.locale);
      toast.success(t("settings.profile.updated"));
      await refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (pw.newPassword !== pw.confirm) {
        throw new ApiError(t("settings.password.mismatch"), 400);
      }
      await apiPatch("/api/auth/password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
    },
    onSuccess: async () => {
      toast.success(t("settings.password.changed"));
      window.location.href = "/login";
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const unlinkMutation = useMutation({
    mutationFn: () => apiDelete("/api/auth/google/unlink"),
    onSuccess: async () => {
      toast.success(t("settings.google.unlinked"));
      await refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const signOutAll = useMutation({
    mutationFn: () => apiPost("/api/auth/sessions"),
    onSuccess: () => {
      window.location.href = "/login";
    },
    onError: () => (window.location.href = "/login"),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.title")}</CardTitle>
          <CardDescription>{t("settings.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="st-name">{t("common.name")}</Label>
            <Input
              id="st-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="st-email">{t("common.email")}</Label>
            <Input
              id="st-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="st-locale">{t("common.language")}</Label>
            <LanguageSelect
              id="st-locale"
              value={form.locale as Locale}
              onChange={(locale) => setForm({ ...form, locale })}
            />
            <p className="text-xs text-muted-foreground">{t("settings.language.description")}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="st-currency">{t("settings.profile.baseCurrency")}</Label>
            <CurrencySelect
              value={form.currency}
              onChange={(code) => setForm({ ...form, currency: code })}
            />
            <p className="text-xs text-muted-foreground">{t("settings.profile.currencyHelp")}</p>
          </div>
          <div>
            <Button
              size="sm"
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? t("common.saving") : t("settings.profile.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance.title")}</CardTitle>
          <CardDescription>{t("settings.appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              {t("settings.appearance.modes")}
            </span>
          </div>
          <div className="flex gap-1">
            {(["light", "dark", "system"] as const).map((mode) => (
              <Button key={mode} variant="outline" size="sm" onClick={() => storeTheme(mode)}>
                {t(`settings.appearance.${mode}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {user.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.password.title")}</CardTitle>
            <CardDescription>{t("settings.password.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="st-curpw">{t("common.currentPassword")}</Label>
              <PasswordInput
                id="st-curpw"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="st-newpw">{t("common.newPassword")}</Label>
                <PasswordInput
                  id="st-newpw"
                  autoComplete="new-password"
                  value={pw.newPassword}
                  onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="st-newpw2">{t("common.confirm")}</Label>
                <PasswordInput
                  id="st-newpw2"
                  autoComplete="new-password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => passwordMutation.mutate()}
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending
                  ? t("settings.password.changing")
                  : t("settings.password.change")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.google.title")}</CardTitle>
          <CardDescription>
            {googleEnabled ? t("settings.google.enabled") : t("settings.google.disabled")}
          </CardDescription>
        </CardHeader>
        {googleEnabled && (
          <CardContent className="flex flex-wrap items-center gap-2">
            {user.googleLinked ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm text-income">
                  <Check className="size-4" aria-hidden /> {t("settings.google.linked")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => unlinkMutation.mutate()}
                  disabled={unlinkMutation.isPending || !user.hasPassword}
                  title={!user.hasPassword ? t("settings.google.setPasswordFirst") : undefined}
                >
                  <Unlink className="size-4" aria-hidden /> {t("settings.google.unlink")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href="/auth/google?link=1">
                  <Link2 className="size-4" aria-hidden /> {t("settings.google.link")}
                </a>
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.sessions.title")}</CardTitle>
          <CardDescription>{t("settings.sessions.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => signOutAll.mutate()}
            disabled={signOutAll.isPending}
          >
            {signOutAll.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LogOut className="size-4" aria-hidden />
            )}
            {t("settings.sessions.signOutAll")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

function CategoriesTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState<CategoryDTO | "new" | null>(null);
  const [form, setForm] = useState({
    name: "",
    icon: "tag",
    color: null as string | null,
    kind: "expense" as "expense" | "income",
  });

  const categoriesQuery = useQuery({
    queryKey: qk.categories,
    queryFn: () => apiGet<CategoryDTO[]>("/api/categories"),
  });
  const categories = categoriesQuery.data ?? [];

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.categories }),
      revalidator.revalidate(),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: () => apiPost("/api/categories", form),
    onSuccess: async () => {
      setEditing(null);
      toast.success(t("settings.categories.created"));
      await refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/categories/${id}`, form),
    onSuccess: async () => {
      setEditing(null);
      toast.success(t("settings.categories.updated"));
      await refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/categories/${id}`),
    onSuccess: async () => {
      toast.success(t("settings.categories.deleted"));
      await refresh();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const grouped = {
    expense: categories.filter((c) => c.kind === "expense"),
    income: categories.filter((c) => c.kind === "income"),
  };

  function startNew() {
    setForm({ name: "", icon: "tag", color: null, kind: "expense" });
    setEditing("new");
  }

  function startEdit(category: CategoryDTO) {
    setForm({
      name: category.name,
      icon: category.icon,
      color: category.color,
      kind: category.kind,
    });
    setEditing(category);
  }

  if (categoriesQuery.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("settings.categories.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.categories.description")}</p>
        </div>
        <Button size="sm" className="shrink-0 gap-2" onClick={startNew}>
          <Plus className="size-4" aria-hidden /> {t("settings.categories.new")}
        </Button>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardContent className="grid max-h-[420px] gap-5 overflow-y-auto p-4">
            {(["expense", "income"] as const).map((kind) => (
              <div key={kind}>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {kind === "expense" ? t("common.expenses") : t("common.income")}
                </p>
                <ul className="grid gap-1">
                  {grouped[kind].map((c) => {
                    const selected = editing !== "new" && editing?.id === c.id;
                    return (
                      <li
                        key={c.id}
                        className={`group flex items-center gap-2 rounded-md px-2 py-1.5 ${
                          selected ? "bg-accent" : "hover:bg-accent/50"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          aria-pressed={selected}
                          onClick={() => startEdit(c)}
                        >
                          <CategoryIcon icon={c.icon} color={c.color} />
                          <span className="flex-1 truncate text-sm">{c.name}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label={t("settings.categories.editAria", { name: c.name })}
                          onClick={() => startEdit(c)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                          aria-label={t("settings.categories.deleteAria", { name: c.name })}
                          onClick={() => {
                            if (confirm(t("settings.categories.deleteConfirm", { name: c.name }))) {
                              if (editing !== "new" && editing?.id === c.id) setEditing(null);
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:sticky md:top-0">
          <CardHeader>
            <CardTitle>
              {editing === "new"
                ? t("settings.categories.newTitle")
                : editing
                  ? t("settings.categories.editTitle")
                  : t("settings.categories.title")}
            </CardTitle>
            <CardDescription>{t("settings.categories.dialogDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing === "new") createMutation.mutate();
                  else updateMutation.mutate(editing.id);
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="cat-name">{t("common.name")}</Label>
                  <Input
                    id="cat-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.kind")}</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) => setForm({ ...form, kind: v as "expense" | "income" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t("common.expense")}</SelectItem>
                      <SelectItem value="income">{t("common.income")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.icon")}</Label>
                  <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ICON_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          <CategoryIcon icon={name} className="mr-2" /> {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.color")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[null, "#22c55e", "#0ea5e9", "#8b5cf6", "#f97316", "#ec4899", "#eab308", "#64748b"].map(
                      (color) => (
                        <button
                          key={String(color)}
                          type="button"
                          aria-label={color ?? t("common.noColor")}
                          className={`size-7 rounded-full border-2 ${
                            form.color === color ? "border-foreground" : "border-transparent"
                          }`}
                          style={{ background: color ?? "var(--muted)" }}
                          onClick={() => setForm({ ...form, color })}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit">
                    {editing === "new" ? t("common.create") : t("common.save")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid place-items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <Tags className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t("settings.categories.dialogDescription")}
                </p>
                <Button size="sm" variant="outline" className="gap-2" onClick={startNew}>
                  <Plus className="size-4" aria-hidden /> {t("settings.categories.new")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Currency rates                                                      */
/* ------------------------------------------------------------------ */

function RatesTab({ baseCurrency }: { baseCurrency: string }) {
  const { t, fmtDateTime, currencyName } = useI18n();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [form, setForm] = useState({ currency: "USD", rate: "" });

  const ratesQuery = useQuery({
    queryKey: qk.rates,
    queryFn: () => apiGet<RateInfo>("/api/rates"),
  });

  const refresh = useMutation({
    mutationFn: () => apiGet<RateInfo>("/api/rates?refresh=1"),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.rates, data);
      toast.success(t("settings.rates.refreshed"));
    },
    onError: () => toast.error(t("settings.rates.refreshFailed")),
  });

  const setOverride = useMutation({
    mutationFn: () =>
      apiPost<RateInfo>("/api/rates", {
        currency: form.currency,
        rate: Number(form.rate.replace(",", ".")),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.rates, data);
      toast.success(t("settings.rates.saved", { currency: form.currency }));
      setForm({ ...form, rate: "" });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  const deleteOverride = useMutation({
    mutationFn: (currency: string) => apiDelete<RateInfo>(`/api/rates?currency=${currency}`),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.rates, data);
      void revalidator.revalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t("common.failed")),
  });

  if (!ratesQuery.data) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t("settings.rates.title")}</CardTitle>
            <CardDescription>{t("settings.rates.description")}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`} aria-hidden />
            {t("common.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p className="text-muted-foreground">
            {ratesQuery.data.available
              ? t("settings.rates.lastUpdated", {
                  date: ratesQuery.data.fetchedAt
                    ? fmtDateTime(ratesQuery.data.fetchedAt)
                    : "—",
                })
              : t("settings.rates.unavailable")}
          </p>
          <p className="text-muted-foreground">
            {t("settings.rates.conversionHelp", { currency: baseCurrency })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.rates.overridesTitle")}</CardTitle>
          <CardDescription>
            {t("settings.rates.overridesDescription", { currency: baseCurrency })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {ratesQuery.data.overrides.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("settings.rates.none")}</p>
          )}
          <ul className="grid gap-2">
            {ratesQuery.data.overrides.map((o) => (
              <li key={o.currency} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{o.currency}</span>
                <span className="text-muted-foreground">{currencyName(o.currency)}</span>
                <span className="ml-auto tabular-nums">
                  1 {o.currency} = {o.rate} {baseCurrency}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={t("settings.rates.removeAria", { currency: o.currency })}
                  onClick={() => deleteOverride.mutate(o.currency)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <Separator />
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.rate) setOverride.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="rate-currency" className="text-xs">
                {t("common.currency")}
              </Label>
              <Input
                id="rate-currency"
                className="w-24 uppercase"
                maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rate-value" className="text-xs">
                {t("settings.rates.rateLabel", { currency: baseCurrency })}
              </Label>
              <Input
                id="rate-value"
                className="w-32"
                inputMode="decimal"
                placeholder="0.92"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                required
              />
            </div>
            <Button size="sm" type="submit" disabled={setOverride.isPending}>
              {t("settings.rates.saveOverride")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

function DataTab({ user }: { user: UserDTO }) {
  const { t, currencyName } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  async function deleteAccount() {
    try {
      await apiDelete("/api/auth/account", { confirm: confirmEmail });
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("common.failed"));
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.data.exportTitle")}</CardTitle>
          <CardDescription>{t("settings.data.exportDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href="/api/export?format=csv" download>
              <Download className="size-4" aria-hidden /> CSV
            </a>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href="/api/export?format=json" download>
              <Download className="size-4" aria-hidden /> JSON
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.data.storageTitle")}</CardTitle>
          <CardDescription>
            {t("settings.data.storageDescription", {
              email: user.email,
              currency: user.currency,
              name: currencyName(user.currency),
            })}
          </CardDescription>
        </CardHeader>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.data.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {t("settings.data.deleteBody")}
                <br />
                <br />
                {t("settings.data.deleteConfirm", { email: user.email })}
                <Input
                  className="mt-2"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
              onClick={deleteAccount}
            >
              <Trash2 className="size-4" aria-hidden /> {t("settings.data.deleteForever")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.data.dangerTitle")}</CardTitle>
          <CardDescription>{t("settings.data.dangerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> {t("settings.data.deleteAccount")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
