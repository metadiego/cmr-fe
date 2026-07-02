// Localized weekday names for cupo config. diaSemana matches the BE: 0=Sunday..6=Saturday.
// 2024-01-07 was a Sunday, so it anchors the 0-index.
export function weekdayLabel(
  locale: string,
  diaSemana: number,
  style: "long" | "short" = "long",
): string {
  const base = new Date(2024, 0, 7 + diaSemana);
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(base);
}

// Monday-first order (Lun..Dom) as diaSemana values: [1,2,3,4,5,6,0].
export const WEEKDAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
