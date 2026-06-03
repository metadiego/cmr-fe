// i18n/request.ts
// next-intl request config (cookie-based, NO URL routing). Runs once per request
// on the server; supplies locale + messages + formatting defaults to every
// Server/Client Component via NextIntlClientProvider.
//
// Next 16: cookies() is async — must be awaited.

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
  // TODO #51 (config por capas): resolve by precedence
  //   override master → user prefs (BE via lib/api) → cookie → default.
  // For now the cookie (set by locale-actions.setLocale) is the only source.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // CONSIDERACIONES-FE #14: date/currency/timezone formatting. Adjust the
    // clinic timezone here if CMR operates elsewhere.
    timeZone: "America/Mexico_City",
    formats: {
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
      number: {
        currency: { style: "currency", currency: "MXN" },
      },
    },
  };
});
