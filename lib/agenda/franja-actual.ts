// Which timed franja ("HH:MM") is "now" in a day's agenda — the row that should get a subtle
// highlight, moving on its own as the clock advances (owner's request, 2026-09-21). Pure: `horas`
// is the day's list of REAL (non-null) franja times in ascending order; `ahora` is "HH:MM". Since
// both are zero-padded 24h "HH:MM", lexicographic comparison IS chronological comparison.
export function franjaActual(horas: string[], ahora: string): string | null {
  let actual: string | null = null;
  for (const h of horas) {
    if (h <= ahora) actual = h;
    else break;
  }
  return actual;
}
