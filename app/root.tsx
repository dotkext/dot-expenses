import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";

import { I18nProvider } from "@/components/i18n-provider";
import { SplashScreen } from "@/components/features/splash-screen";
import { Providers } from "@/components/providers";
import { googleAuthEnabled } from "@/lib/env";
import {
  DEFAULT_LOCALE,
  getI18n,
  isLocale,
  LOCALE_COOKIE,
  pickLocaleFromHeader,
  toLocale,
  type Locale,
} from "@/lib/i18n/core";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import type { RootLoaderData } from "@/lib/types";
import { getAuth, getCookie } from "@/server/auth.service";

import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData("root") as RootLoaderData | undefined;
  const locale = root?.locale ?? DEFAULT_LOCALE;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>dot-expenses</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export async function loader({ request }: Route.LoaderArgs): Promise<RootLoaderData> {
  const url = new URL(request.url);
  const cookieLocale = getCookie(request, LOCALE_COOKIE);
  const headerLocale = pickLocaleFromHeader(request.headers.get("accept-language"));
  let locale: Locale = isLocale(cookieLocale) ? cookieLocale : headerLocale;

  // API requests don't render UI — skip the session lookup there.
  if (!url.pathname.startsWith("/api/")) {
    const user = await getAuth(request);
    if (user) locale = toLocale(user.locale);
  }

  return { googleAuthEnabled, locale };
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <I18nProvider locale={loaderData.locale}>
      <Providers>
        <Outlet />
        <SplashScreen />
      </Providers>
    </I18nProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const root = useRouteLoaderData("root") as RootLoaderData | undefined;
  const { t } = getI18n(root?.locale ?? DEFAULT_LOCALE);

  let message = t("error.somethingWentWrong");
  let details = t("error.unexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? t("error.notFoundTitle") : t("error.statusTitle", { status: error.status });
    details = error.status === 404 ? t("error.notFoundBody") : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-4xl font-bold text-muted-foreground">:(</p>
        <h1 className="mt-4 text-xl font-semibold">{message}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{details}</p>
        {stack && (
          <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-muted p-4 text-left text-xs">
            <code>{stack}</code>
          </pre>
        )}
        <a
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("error.backHome")}
        </a>
      </div>
    </main>
  );
}
