// i18n/locale-actions.ts
// Server Action that persists the chosen locale in a cookie. Called by the
// client <LanguageToggle/>, which then router.refresh()es so Server Components
// re-render under the new locale.
//
// Next 16: cookies() is async.
"use server";

import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
