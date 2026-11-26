import { useI18n } from "@/components/i18n-provider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Category } from "../types";

const NONE = "__none__";

export function AccountSelect({
  accounts,
  value,
  onChange,
  allowNone = true,
  exclude,
  id,
}: {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
  exclude?: string;
  id?: string;
}) {
  const { t } = useI18n();
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectGroup>
            <SelectItem value={NONE}>
              <span className="text-muted-foreground">{t("account.none")}</span>
            </SelectItem>
          </SelectGroup>
        )}
        <SelectGroup>
          <SelectLabel>{t("account.accounts")}</SelectLabel>
          {accounts
            .filter((account) => account.id !== exclude)
            .map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({
  categories,
  value,
  onChange,
  kind,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  kind?: string;
}) {
  const { t } = useI18n();
  return (
    <Select
      value={value || NONE}
      onValueChange={(next) => onChange(next === NONE ? "" : next)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">{t("common.uncategorized")}</span>
          </SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>
            {kind === "income" ? t("category.income") : t("category.categories")}
          </SelectLabel>
          {categories
            .filter((category) => !kind || category.kind === kind)
            .map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
