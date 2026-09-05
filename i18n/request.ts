// i18n/request.ts
// next-intl request config (cookie-based, NO URL routing). Runs once per request
// on the server; supplies locale + messages + formatting defaults to every
// Server/Client Component via NextIntlClientProvider.
//
// Next 16: cookies() is async — must be awaited.

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { IntlErrorCode } from "next-intl";

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { BUSINESS_TIME_ZONE, formats } from "./formats";
import { humanizeKey } from "@/lib/i18n/humanize";

export default getRequestConfig(async () => {
  // TODO #51 (config por capas): resolve by precedence
  //   override master → user prefs (BE via lib/api) → cookie → default.
  // For now the cookie (set by locale-actions.setLocale) is the only source.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Business is USA/Puerto Rico → AST + USD. (Ideally per-center via preferences
    // `citas.timezone`; fixed default for now.)
    timeZone: BUSINESS_TIME_ZONE,
    // Shared with the client provider (i18n/formats.ts) so a Server Component and a
    // Client Component asked for the same named format render the same string.
    formats,
    // Metadata-driven boards bring labelKeys the FE may not translate yet (new
    // verticals are config-only). Missing keys fall back to a humanized label
    // instead of the raw key, silently (no dev-overlay noise).
    onError(error) {
      if (error.code !== IntlErrorCode.MISSING_MESSAGE) console.error(error);
    },
    getMessageFallback({ key }) {
      return humanizeKey(key);
    },
  };
});
