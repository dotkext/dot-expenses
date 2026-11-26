import { Outlet, redirect } from "react-router";
import type { Route } from "./+types/auth-layout";

import { AuthPreferences } from "@/components/features/auth-preferences";
import { Brand } from "@/components/features/brand";
import { Particles } from "@/components/features/particles";
import { getAuth } from "@/server/auth.service";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getAuth(request);
  if (user) throw redirect("/");
  return null;
}

export default function AuthLayout() {
  return (
    <div className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-muted/30 px-6 py-10 dark:bg-[#050506]">
      {/* Deep-space wash: greyscale nebula haze over near-black, closed off by a vignette. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(120% 100% at 12% 0%, rgba(255,255,255,0.10) 0%, transparent 55%)," +
            "radial-gradient(100% 90% at 88% 100%, rgba(255,255,255,0.07) 0%, transparent 55%)," +
            "radial-gradient(80% 70% at 55% 15%, rgba(255,255,255,0.05) 0%, transparent 60%)," +
            "linear-gradient(118deg, transparent 32%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.03) 53%, transparent 66%)," +
            "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.78) 100%)",
        }}
      />

      <Particles
        className="text-foreground opacity-40 dark:text-white dark:opacity-75"
        quantity={195}
        size={1.8}
        speed={0.02}
        repel={190}
      />

      <AuthPreferences />

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        {/* Branding: dot-expenses is one app in the dotNetwork suite. */}
        <header className="flex justify-center">
          <Brand />
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
