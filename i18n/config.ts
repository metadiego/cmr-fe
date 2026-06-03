// i18n/config.ts
// Single source of truth for the supported locales. Adding a language = add it
// here and create the matching messages/<locale>.json.

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

// Spanish is the default: the existing UI was authored in Spanish, so an
// untagged visitor sees no change.
export const defaultLocale: Locale = "es";

// Cookie that persists the chosen locale (read in i18n/request.ts, written by
// i18n/locale-actions.ts).
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
