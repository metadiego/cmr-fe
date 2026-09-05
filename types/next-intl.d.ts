// Teaches next-intl about the named formats declared in i18n/formats.ts.
//
// Without this, the second argument of `format.dateTime(date, "monthYear")` is just `string`:
// a typo like "monthYaer" would compile, silently fall back to the default format at runtime,
// and quietly undo the fix this module exists for. With it, the format names are checked.
import type { formats } from "@/i18n/formats";

declare module "next-intl" {
  interface AppConfig {
    Formats: typeof formats;
  }
}
