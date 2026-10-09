// The light/dark mode to apply, from the profile preferences the BE resolves. Light is the default;
// dark ONLY when the profile explicitly says so. Reads both the Spanish contract (`tema`: "claro" |
// "oscuro") and the English one the v2 API may translate it to (`theme`: "light" | "dark"), so a key
// rename on the BE can never leave a stale dark mode from this browser's storage in place.
export type AppTheme = "light" | "dark";

export function appThemeFromPreferences(
  prefs: { tema?: unknown; theme?: unknown } | null | undefined,
): AppTheme {
  const raw = prefs?.tema ?? prefs?.theme;
  return raw === "oscuro" || raw === "dark" ? "dark" : "light";
}
