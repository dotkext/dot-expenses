import { useState } from "react";
import {
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { CurrencySelect } from "@/components/features/currency-select";
import { LanguageSelect } from "@/components/features/language-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backend } from "../backend";
import type { Bootstrap, Category, CategoryInput, RateInfo } from "../types";
import type { Locale } from "@/lib/i18n/core";

type Section = "profile" | "categories" | "rates";

const SECTIONS = [
  { id: "profile", icon: UserRound, key: "settings.profile.title" },
  { id: "categories", icon: Tags, key: "settings.categories.title" },
  { id: "rates", icon: RefreshCw, key: "settings.rates.title" },
] as const;

export function SettingsDialog({
  boot,
  open,
  onOpenChange,
  onChanged,
}: {
  boot: Bootstrap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { t, fmtDateTime } = useI18n();
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState(boot.profile);
  const [categories, setCategories] = useState<Category[]>(boot.categories);
  const [rates, setRates] = useState<RateInfo>(boot.rates);
  const [categoryEditing, setCategoryEditing] = useState<Category | "new" | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryInput>({
    name: "",
    kind: "expense",
    icon: "tag",
    color: "",
  });
  const [override, setOverride] = useState({ currency: "", rate: 0 });

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      const updated = await backend.UpdateProfile(profile);
      setProfile(updated);
      toast.success(t("settings.profile.updated"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  function editCategory(category: Category | "new") {
    setCategoryEditing(category);
    setCategoryForm(
      category === "new"
        ? { name: "", kind: "expense", icon: "tag", color: "" }
        : { name: category.name, kind: category.kind, icon: category.icon, color: category.color },
    );
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (categoryEditing && categoryEditing !== "new") {
        await backend.UpdateCategory(categoryEditing.id, categoryForm);
      } else {
        await backend.CreateCategory(categoryForm);
      }
      const list = await backend.ListCategories();
      setCategories(list);
      setCategoryEditing(null);
      toast.success(
        categoryEditing === "new"
          ? t("settings.categories.created")
          : t("settings.categories.updated"),
      );
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(t("settings.categories.deleteConfirm", { name: category.name }))) return;
    try {
      await backend.DeleteCategory(category.id);
      setCategories(await backend.ListCategories());
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  async function refreshRates() {
    try {
      setRates(await backend.RefreshRates());
      toast.success(t("settings.rates.refreshed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.rates.refreshFailed"));
    }
  }

  async function saveOverride(event: React.FormEvent) {
    event.preventDefault();
    try {
      await backend.SaveRateOverride(override);
      setRates(await backend.GetRates());
      setOverride({ currency: "", rate: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex h-[min(70vh,640px)] min-h-[480px]">
          <aside className="w-52 shrink-0 border-r bg-muted/20 p-3">
            <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("settings.title")}
            </p>
            <nav className="grid gap-1">
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
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(item.key)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "profile" && (
              <form className="grid max-w-lg gap-4" onSubmit={saveProfile}>
                <div className="grid gap-2">
                  <Label htmlFor="profile-name">{t("common.name")}</Label>
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">{t("common.email")}</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("settings.profile.baseCurrency")}</Label>
                  <CurrencySelect
                    value={profile.currency}
                    onChange={(currency) => setProfile({ ...profile, currency })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.language")}</Label>
                  <LanguageSelect
                    value={profile.locale as Locale}
                    onChange={(locale) => setProfile({ ...profile, locale })}
                  />
                </div>
                <Button type="submit" size="sm" className="justify-self-start">
                  {t("settings.profile.save")}
                </Button>
              </form>
            )}

            {section === "categories" && (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.categories.description")}
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => editCategory("new")}>
                    <Plus className="size-4" /> {t("settings.categories.new")}
                  </Button>
                </div>

                <ul className="grid gap-1">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: category.color || "var(--muted-foreground)" }}
                      />
                      <span className="flex-1 truncate text-sm">{category.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {category.kind === "income" ? t("common.income") : t("common.expense")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => editCategory(category)}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCategory(category)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>

                {categoryEditing && (
                  <form className="grid gap-3 rounded-lg border p-4" onSubmit={saveCategory}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {categoryEditing === "new"
                          ? t("settings.categories.newTitle")
                          : t("settings.categories.editTitle")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCategoryEditing(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                      <div className="grid gap-2">
                        <Label htmlFor="cat-name">{t("common.name")}</Label>
                        <Input
                          id="cat-name"
                          value={categoryForm.name}
                          onChange={(event) =>
                            setCategoryForm({ ...categoryForm, name: event.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("common.kind")}</Label>
                        <Select
                          value={categoryForm.kind}
                          onValueChange={(kind) => setCategoryForm({ ...categoryForm, kind })}
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
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cat-color">{t("common.color")}</Label>
                      <Input
                        id="cat-color"
                        type="color"
                        value={categoryForm.color || "#64748b"}
                        onChange={(event) =>
                          setCategoryForm({ ...categoryForm, color: event.target.value })
                        }
                        className="h-9 w-20 p-1"
                      />
                    </div>
                    <Button type="submit" size="sm" className="justify-self-start">
                      {categoryEditing === "new" ? t("common.create") : t("common.save")}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {section === "rates" && (
              <div className="grid max-w-2xl gap-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {rates.available
                      ? t("settings.rates.lastUpdated", { date: fmtDateTime(rates.fetchedAt) })
                      : t("settings.rates.unavailable")}
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={refreshRates}>
                    <RefreshCw className="size-4" /> {t("common.refresh")}
                  </Button>
                </div>

                <div className="grid gap-3">
                  <p className="text-sm font-semibold">{t("settings.rates.overridesTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.rates.overridesDescription", { currency: profile.currency })}
                  </p>
                  <form className="flex items-end gap-2" onSubmit={saveOverride}>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-currency">{t("common.currency")}</Label>
                      <Input
                        id="rate-currency"
                        className="w-24"
                        maxLength={3}
                        value={override.currency}
                        onChange={(event) =>
                          setOverride({ ...override, currency: event.target.value.toUpperCase() })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rate-value">{t("settings.rates.rateLabel", { currency: profile.currency })}</Label>
                      <Input
                        id="rate-value"
                        inputMode="decimal"
                        className="w-32"
                        value={override.rate || ""}
                        onChange={(event) =>
                          setOverride({ ...override, rate: Number(event.target.value) || 0 })
                        }
                      />
                    </div>
                    <Button type="submit" size="sm">
                      {t("settings.rates.saveOverride")}
                    </Button>
                  </form>
                  <ul className="grid gap-1">
                    {rates.overrides.map((item) => (
                      <li
                        key={item.currency}
                        className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
                      >
                        <span className="font-mono">{item.currency}</span>
                        <span className="flex-1 tabular-nums">{item.rate}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            await backend.DeleteRateOverride(item.currency);
                            setRates(await backend.GetRates());
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
                  <p>
                    {t("settings.data.storageDescription", {
                      email: profile.email || "—",
                      currency: profile.currency,
                      name: profile.name,
                    })}
                  </p>
                  <p className="break-all font-mono">SQLite: {boot.dbPath}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
