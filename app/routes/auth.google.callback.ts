import { redirect } from "react-router";
import type { Route } from "./+types/auth.google.callback";

import {
  createSession,
  getAuth,
  getCookie,
  linkGoogleAccount,
  loginWithGoogle,
  sessionCookieSet,
} from "@/server/auth.service";
import { isLocale, LOCALE_COOKIE, pickLocaleFromHeader } from "@/lib/i18n/core";
import {
  exchangeCode,
  getRedirectUri,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleConfigured,
  oauthCookieClear,
} from "@/server/google.service";

export async function loader({ request }: Route.LoaderArgs) {
  if (!googleConfigured()) throw new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const stateCookie = getCookie(request, GOOGLE_STATE_COOKIE) ?? "";
  const [expectedState, linkFlag] = stateCookie.split("|");
  const verifier = getCookie(request, GOOGLE_VERIFIER_COOKIE) ?? "";

  const headers = new Headers();
  headers.append("Set-Cookie", oauthCookieClear(GOOGLE_STATE_COOKIE));
  headers.append("Set-Cookie", oauthCookieClear(GOOGLE_VERIFIER_COOKIE));

  const fail = (reason: string) => {
    console.warn(`[google-oauth] ${reason}`);
    return redirect("/login?error=google", { headers });
  };

  if (!code || !state || !verifier) throw fail("missing code/state/verifier");
  if (state !== expectedState) throw fail("state mismatch");

  try {
    const profile = await exchangeCode(code, verifier, getRedirectUri(request));
    if (!profile.emailVerified) throw fail("email not verified");

    if (linkFlag === "1") {
      // Linking an existing signed-in account from Settings
      const user = await getAuth(request);
      if (!user) throw fail("no session for linking");
      await linkGoogleAccount(user.id, profile.providerUserId);
      throw redirect("/?settings=linked", { headers });
    }

    const cookieLocale = getCookie(request, LOCALE_COOKIE);
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : pickLocaleFromHeader(request.headers.get("accept-language"));

    const user = await loginWithGoogle(
      {
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
      },
      locale,
    );

    const token = await createSession(user.id, request.headers.get("user-agent"));
    headers.append("Set-Cookie", sessionCookieSet(request, token));
    throw redirect("/", { headers });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw fail((error as Error).message);
  }
}
