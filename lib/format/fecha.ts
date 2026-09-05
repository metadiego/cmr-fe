// Formateo de fechas SOLO-DÍA sin corrimiento de zona horaria.
//
// El BE devuelve fechas de columna `date` como "YYYY-MM-DD" (sin hora). `new Date("2026-07-21")` las
// parsea como UTC medianoche; al mostrarlas en la zona de PR (AST, UTC-4) retroceden a 2026-07-20 → la
// factura de hoy aparece "un día antes". Solución: formatear el string directo (nunca `new Date(str)` para
// solo-día). Negocio USA/PR → formato MM/DD/YYYY. Ver .personal/HANDOFF-fecha-factura-off-by-one.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

// "2026-07-21" (o "2026-07-21T...") → "07/21/2026", sin pasar por Date (cero corrimiento de zona).
// Datetime completo → usa componentes LOCALES (no UTC). Vacío/ inválido → "".
export function formatFechaSolo(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v);
  const m = s.match(DATE_ONLY);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// A calendar day ("2026-07-21") turned into a Date to hand to the day-only formats in
// i18n/formats.ts (`dayLong`, `monthYear`, `dayWeekdayLong`, ...), which all pin UTC.
//
// The anchor is UTC NOON, not midnight: UTC midnight falls on the previous day for any
// zone to the west (PR is UTC-4), and LOCAL midnight — what the old
// `new Date(iso + "T00:00:00")` pattern produced — falls on the previous day for any
// browser to the east. UTC noon is the same calendar day in both directions (a 12h
// margin either way), so pairing "UTC noon" with "format pinned to UTC" always prints
// the intended day, on every machine.
//
// Accepts "YYYY-MM-DD" and full datetimes (takes their day part). Invalid -> null.
export function parseDayUTC(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const m = String(v).match(DATE_ONLY);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}
