// Per-column filters of the day's summary (owner 18-nov-2026: «filtros por Récord, Paciente, Cantidad,
// Dosis, Enfermera, Asistido por, Hora, Viales»). Free-text columns match by «contains» (accents and case
// ignored); the rest pick one exact value out of the ones present that day. Pure, tested.

export type FilterKind = "text" | "pick";
/** Record, patient and time are typed («08», «p. m.»); everything else is a short list of the values of the day. */
export const FILTER_KIND: Record<string, FilterKind> = { record: "text", patient: "text", time: "text" };
export const filterKind = (col: string): FilterKind => FILTER_KIND[col] ?? "pick";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Rows that pass every active filter; `text(row, col)` is what the cell shows. */
export function filterRows<R>(rows: readonly R[], filters: Readonly<Record<string, string>>, text: (r: R, col: string) => string): R[] {
  const active = Object.entries(filters).filter(([, v]) => v.trim() !== "");
  if (!active.length) return [...rows];
  return rows.filter((r) =>
    active.every(([col, v]) => (filterKind(col) === "text" ? fold(text(r, col)).includes(fold(v)) : text(r, col) === v))
  );
}

/** The distinct values a «pick» column has, numbers in numeric order, the rest alphabetically. */
export function distinctValues<R>(rows: readonly R[], col: string, text: (r: R, col: string) => string): string[] {
  const vals = [...new Set(rows.map((r) => text(r, col)))];
  const allNum = vals.every((v) => v !== "" && !Number.isNaN(Number(v.replace(",", "."))));
  return allNum ? vals.sort((a, b) => Number(a.replace(",", ".")) - Number(b.replace(",", "."))) : vals.sort((a, b) => a.localeCompare(b));
}

/** Totals of the rows on screen (when filtering, the footer and the stats speak for what is shown). */
export function sumRows(rows: readonly { quantity: number; sealedVials: number; content: number; patient: string | null; medicalRecordNumber?: string | null; record?: string | null }[]) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    sessions: rows.length,
    patients: new Set(rows.map((r) => r.medicalRecordNumber ?? r.record ?? r.patient)).size,
    quantity: r2(rows.reduce((a, r) => a + r.quantity, 0)),
    sealedVials: r2(rows.reduce((a, r) => a + r.sealedVials, 0)),
    content: r2(rows.reduce((a, r) => a + r.content, 0)),
  };
}
