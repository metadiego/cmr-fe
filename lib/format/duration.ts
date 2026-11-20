// A length of time as "3h 15m" — like the 24-hour clock and USD money (i18n/formats.ts), "h"/"m"
// are the same letters in Spanish and English, so this is formatting, not a translation.
export function formatDurationMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
