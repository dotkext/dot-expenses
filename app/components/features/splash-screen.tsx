import { useEffect, useState } from "react";

import { Brand } from "@/components/features/brand";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

/** How long the splash holds before it starts fading. */
const HOLD_MS = 900;
/** Matches the `duration-500` fade below. */
const FADE_MS = 500;

/**
 * Branded hand-off between signing in and the first app paint. Login and
 * register raise it right before navigating; it covers the dashboard while the
 * app shell mounts, then fades away and unmounts.
 */
export function SplashScreen() {
  const { t } = useI18n();
  const visible = useUiStore((state) => state.splashVisible);
  const hideSplash = useUiStore((state) => state.hideSplash);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setClosing(false);

    const fadeTimer = window.setTimeout(() => setClosing(true), HOLD_MS);
    const hideTimer = window.setTimeout(() => hideSplash(), HOLD_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [visible, hideSplash]);

  // Keep the freshly mounted app behind the splash from scrolling.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "dark fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 overflow-hidden bg-[#050506] text-white transition-opacity duration-500 motion-reduce:transition-none",
        closing ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 60%)," +
            "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      <Brand size="lg" className="relative" subtitleClassName="text-white/50" />

      <div className="relative h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="splash-progress h-full w-2/5 rounded-full bg-white/80" />
      </div>

      <p className="relative text-xs text-white/40">{t("splash.loading")}</p>
    </div>
  );
}
