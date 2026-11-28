// The MLS laser sheet, drawn like the legacy «MLS Form» (.personal/formatos-legacy/MLS Form.pdf). Pure
// helpers: the legacy's date, and the two pathology tables brought to the same height.

/**
 * The legacy prints the day as MM-DD-YYYY ("10-09-2026"; the procedure sheets use "/"); digits only, so it
 * carries no language.
 */
export function legacyDay(
  iso: string | null | undefined,
  sep: "-" | "/" = "-"
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "")
  return m ? [m[2], m[3], m[1]].join(sep) : ""
}

/** A parameter cell: the value as given, blank when there is none (the legacy never prints «—»). */
export function cell(v: string | number | null | undefined): string {
  return v == null ? "" : String(v).trim()
}

/** How many times «Número de Terapias» repeats (owner, 17-nov-2026): once per área, min 1 — 1, 0,
 * negative or no data all fall back to a single repeat (the session alone, never duplicated for
 * nothing and never zero). Shared by MLS and HILT (laser-sheet-parts.tsx SesionPorAreas). */
export function areasCount(areas: number | null | undefined): number {
  return Math.max(1, Math.trunc(Number(areas) || 1))
}

/** Both tables with the same number of rows (blank rows pad the shorter one), side by side. */
export function sameHeight<T>(
  left: readonly T[],
  right: readonly T[]
): { left: (T | null)[]; right: (T | null)[] } {
  const n = Math.max(left.length, right.length)
  const pad = (a: readonly T[]) => [
    ...a,
    ...Array.from({ length: n - a.length }, () => null),
  ]
  return { left: pad(left), right: pad(right) }
}
