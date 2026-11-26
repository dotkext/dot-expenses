import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { CategoryIcon } from "@/components/features/category-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { CategoryDTO } from "@/lib/types";

const UNCATEGORIZED = "__none__";

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => apiGet<CategoryDTO[]>("/api/categories"),
  });
}

export function CategorySelect({
  value,
  onChange,
  kind,
  disabled,
  id,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Filter to expense or income categories. */
  kind?: "expense" | "income";
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useI18n();
  const { data: categories } = useCategories();
  const filtered = (categories ?? []).filter((c) => !kind || c.kind === kind);
  const grouped = {
    [kind ?? "all"]: filtered,
  };

  return (
    <Select
      value={value ?? UNCATEGORIZED}
      onValueChange={(v) => onChange(v === UNCATEGORIZED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("common.category")} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={UNCATEGORIZED}>
            <span className="text-muted-foreground">{t("common.uncategorized")}</span>
          </SelectItem>
        </SelectGroup>
        {Object.entries(grouped).map(([label, items]) => (
          <SelectGroup key={label}>
            <SelectLabel>
              {label === "expense"
                ? t("category.expenses")
                : label === "income"
                  ? t("category.income")
                  : t("category.categories")}
            </SelectLabel>
            {items.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryIcon icon={c.icon} color={c.color} className="mr-2" />
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
