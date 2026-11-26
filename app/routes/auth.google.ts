import { redirect } from "react-router";
import type { Route } from "./+types/auth.google";

import {
  createAuthUrl,
  generateCodeVerifier,
  generateState,
  getRedirectUri,
  GOOGLE_STATE_COOKIE,
  GOOGLE_VERIFIER_COOKIE,
  googleConfigured,
  oauthCookie,
} from "@/server/google.service";

export async function loader({ request }: Route.LoaderArgs) {
  if (!googleConfigured()) {
    throw new Response("Google sign-in is not configured on this server", { status: 404 });
  }

  const url = new URL(request.url);
  const linkMode = url.searchParams.get("link") === "1";

  const state = generateState();
  const verifier = generateCodeVerifier();
  const authUrl = createAuthUrl(state, verifier, getRedirectUri(request));

  const headers = new Headers();
  // state cookie doubles as the link-mode flag: "state|1"
  headers.append("Set-Cookie", oauthCookie(GOOGLE_STATE_COOKIE, `${state}|${linkMode ? 1 : 0}`, request));
  headers.append("Set-Cookie", oauthCookie(GOOGLE_VERIFIER_COOKIE, verifier, request));
  throw redirect(authUrl, { headers });
}
