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
