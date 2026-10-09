// Sentence case for a formatted label: only the first letter is raised, so "octubre de 2026"
// becomes "Octubre de 2026". CSS `capitalize` raises every word ("Octubre De 2026"), which is
// wrong in Spanish, so period titles go through this instead.
export function sentenceCase(s: string, locale?: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}
