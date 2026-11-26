import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n-provider";
import { CurrencySelect } from "@/components/features/currency-select";
import { LanguageSelect } from "@/components/features/language-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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

export function SettingsPage({
  boot,
  onChanged,
}: {
  boot: Bootstrap;
  onChanged: () => void;
}) {
  const { t, fmtDateTime } = useI18n();
  const [profile, setProfile] = useState(boot.profile);
  const [categories, setCategories] = useState<Category[]>(boot.categories);
  const [rates, setRates] = useState<RateInfo>(boot.rates);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
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
      await backend.UpdateProfile(profile);
      toast.success(t("settings.profile.updated"));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.failed"));
    }
  }

  function editCategory(category: Category | null) {
    setEditing(category);
    setCategoryForm(
      category
        ? { name: category.name, kind: category.kind, icon: category.icon, color: category.color }
        : { name: "", kind: "expense", icon: "tag", color: "" },
    );
    setCategoryOpen(true);
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (editing) {
        await backend.UpdateCategory(editing.id, categoryForm);
      } else {
        await backend.CreateCategory(categoryForm);
      }
      const list = await backend.ListCategories();
      setCategories(list);
      setCategoryOpen(false);
      toast.success(editing ? t("settings.categories.updated") : t("settings.categories.created"));
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
    <div className="grid gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.profile.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={saveProfile}>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("settings.categories.title")}</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => editCategory(null)}>
              <Plus className="size-4" /> {t("settings.categories.new")}
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="grid max-h-80 gap-1 overflow-y-auto">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: category.color || "var(--muted-foreground)" }}
                  />
                  <span className="flex-1 truncate text-sm">{category.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {category.kind === "income" ? t("common.income") : t("common.expense")}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => editCategory(category)}>
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
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("settings.rates.title")}</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={refreshRates}>
              <RefreshCw className="size-4" /> {t("common.refresh")}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="text-sm text-muted-foreground">
              <p>
                {rates.available
                  ? t("settings.rates.lastUpdated", { date: fmtDateTime(rates.fetchedAt) })
                  : t("settings.rates.unavailable")}
              </p>
              <p className="mt-3 text-xs">{t("settings.data.storageDescription", {
                email: profile.email || "—",
                currency: profile.currency,
                name: profile.name,
              })}</p>
              <p className="mt-3 break-all font-mono text-[11px]">SQLite: {boot.dbPath}</p>
            </div>
            <div className="grid gap-3">
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
                  <Label htmlFor="rate-value">{t("settings.rates.saveOverride")}</Label>
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
                  {t("common.save")}
                </Button>
              </form>
              <ul className="grid gap-1">
                {rates.overrides.map((item) => (
                  <li key={item.currency} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("settings.categories.editTitle") : t("settings.categories.newTitle")}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={saveCategory}>
            <div className="grid gap-2">
              <Label htmlFor="cat-name">{t("common.name")}</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
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
            <div className="grid gap-2">
              <Label htmlFor="cat-color">{t("common.color")}</Label>
              <Input
                id="cat-color"
                type="color"
                value={categoryForm.color || "#64748b"}
                onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })}
                className="h-9 w-20 p-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCategoryOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{editing ? t("common.save") : t("common.create")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
