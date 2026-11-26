import { redirect } from "react-router";

import type { Route } from "./+types/settings";

/**
 * Settings is a dialog owned by the app shell. Keep the old URL working by
 * redirecting into the shell with a flag that opens it.
 */
export function loader({ request }: Route.LoaderArgs) {
  const linked = new URL(request.url).searchParams.get("linked") === "1";
  return redirect(linked ? "/?settings=linked" : "/?settings=1");
}

export default function SettingsRoute() {
  return null;
}
