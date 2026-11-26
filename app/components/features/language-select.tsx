import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

/** Language picker using each language's endonym. */
export function LanguageSelect({
  value,
  onChange,
  id,
  disabled,
  className,
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Locale)} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {t(`language.${locale}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
