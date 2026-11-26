import { cn } from "@/lib/utils";
import { Banknote } from "lucide-react";

export function Logo({
  className,
  scalable = false,
  iconOnly = false,
}: {
  className?: string;
  /** Size the icon in `em` so the whole lockup scales with its font size. */
  scalable?: boolean;
  /** Render only the mark, e.g. for the collapsed sidebar rail. */
  iconOnly?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold tracking-tight",
        scalable ? "gap-[0.4em]" : "gap-2",
        className,
      )}
      role={iconOnly ? "img" : undefined}
      aria-label={iconOnly ? "dotExpenses" : undefined}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center bg-primary text-primary-foreground",
          scalable ? "size-[1.4em] rounded-[0.3em]" : "size-7 rounded-md",
        )}
      >
        <Banknote className={scalable ? "size-[0.8em]" : "size-4"} aria-hidden />
      </span>
      {!iconOnly && (
        <span>
          dot<span className="text-muted-foreground">Expenses</span>
        </span>
      )}
    </span>
  );
}
