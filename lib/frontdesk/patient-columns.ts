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
