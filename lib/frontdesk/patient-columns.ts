// In the patient desk the patient is already the title of the detail, so the per-service tables drop
// the columns that only repeat who it is (name, record), and the notify bell moves to the block title.
// Keys as the BE places them: service boards use fd_*, the consultation board plain names.

const PATIENT_KEYS = new Set(["fd_paciente", "fd_record", "paciente", "record"]);

export interface ColumnLike {
  clave: string;
  render?: unknown;
}

export const isNotifyColumn = (c: ColumnLike) => (c.render as { kind?: string } | null)?.kind === "notificar";

// Columns shown inside a patient's block: everything but name, record and the notify bell.
export function blockColumns<C extends ColumnLike>(cols: C[]): C[] {
  return cols.filter((c) => !PATIENT_KEYS.has(c.clave) && !isNotifyColumn(c));
}

export function notifyColumn<C extends ColumnLike>(cols: C[]): C | undefined {
  return cols.find(isNotifyColumn);
}

// "Presente" moved to the patient header (one arrival per patient, not per entity — 13-oct-2026,
// record 15612): the consultation's own flow column is dropped entirely here, unlike the services'
// `pasosOcultos` (FilaSesion positions its flow by array INDEX, so presente has to stay in the array
// to keep "en_terapia"/"asistido" at the right slot). The consultation's FlujoAtencion has no such
// dependency — resolveToggle (lib/tablero/toggle-hora.ts) reads each column's OWN target state vs.
// the row's real estado, never a sibling's position — so simply filtering the column out is safe.
export function hidePresente<C extends ColumnLike>(cols: C[]): C[] {
  return cols.filter((c) => c.clave !== "presente");
}
