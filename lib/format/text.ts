// Sentence case for a formatted label: only the first letter is raised, so "octubre de 2026"
// becomes "Octubre de 2026". CSS `capitalize` raises every word ("Octubre De 2026"), which is
// wrong in Spanish, so period titles go through this instead.
export function sentenceCase(s: string, locale?: string): string {
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

// Readable fallback for a raw db slug (e.g. a billing group's "sin_clasificar") when its
// `labelKey` is missing from the catalogue: "sin_clasificar" → "Sin Clasificar". Printing the
// slug verbatim is a document a patient reads, not a debug log.
export function titleCaseSlug(slug: string): string {
  return slug.replace(/[_-]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}
