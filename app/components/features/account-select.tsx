import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { AccountIcon } from "@/components/features/account-icon";
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
import type { AccountDTO } from "@/lib/types";

const NO_ACCOUNT = "__none__";

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: () => apiGet<AccountDTO[]>("/api/accounts"),
  });
}

export function AccountSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useI18n();
  const { data: accounts } = useAccounts();

  return (
    <Select
      value={value ?? NO_ACCOUNT}
      onValueChange={(v) => onChange(v === NO_ACCOUNT ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("common.account")} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={NO_ACCOUNT}>
            <span className="text-muted-foreground">{t("account.none")}</span>
          </SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>{t("account.accounts")}</SelectLabel>
          {(accounts ?? []).map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <AccountIcon type={a.type} className="mr-2 size-4" />
              {a.name}
              {a.isDefault ? " ·" : ""}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
