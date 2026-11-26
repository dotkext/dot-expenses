import { useI18n } from "@/components/i18n-provider";
import { Logo } from "@/components/features/logo";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
} as const;

/**
 * The dotExpenses wordmark with its "a dotNetwork app" signature, aligned
 * under the wordmark. Everything is sized in `em` from the root font size, so
 * `size` (or a font-size class) scales the whole lockup to fit tight widths.
 * The lockup is decorative and must never be selectable.
 */
export function Brand({
  size = "md",
  className,
  subtitleClassName,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  subtitleClassName?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 flex-col items-end gap-[0.1em] leading-none select-none",
        SIZES[size],
        className,
      )}
    >
      <Logo scalable className="max-w-full" />
      <p
        className={cn(
          "max-w-full truncate pr-[0.1em] text-[0.55em] leading-none text-muted-foreground",
          subtitleClassName,
        )}
      >
        {t("auth.dotNetworkApp")}
      </p>
    </div>
  );
}
