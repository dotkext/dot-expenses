import { Banknote, CreditCard, Landmark, PiggyBank, Wallet } from "lucide-react";

import type { TranslationKey } from "@/lib/i18n/core";
import type { AccountType } from "@/lib/types";

const ICONS: Record<AccountType, typeof Landmark> = {
  bank: Landmark,
  card: CreditCard,
  cash: Banknote,
  wallet: Wallet,
  other: PiggyBank,
};

/** Translation key for the human label of an account type. */
export function accountTypeKey(type: AccountType): TranslationKey {
  return `accountType.${type}`;
}

export function AccountIcon({ type, className }: { type: AccountType; className?: string }) {
  const Icon = ICONS[type] ?? PiggyBank;
  return <Icon className={className} aria-hidden />;
}
