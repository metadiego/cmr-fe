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
// A service's own status column (fd_estado) only repeats what the shared arrival in the patient header
// and the flow already say — "Presente" — so the service blocks drop it too (owner, 14-oct-2026).
export function hideServiceStatus<C extends ColumnLike>(cols: C[]): C[] {
  return cols.filter((c) => c.clave !== "fd_estado");
}

// Who performs the session (technician / nurse select) — the BE's stable keys.
const STAFF_KEYS = new Set(["fd_tecnico", "fd_enfermera"]);
export const isStaffColumn = (c: ColumnLike) => STAFF_KEYS.has(c.clave);

// Every service block starts with the same two columns — who performs it, then the flow — so they line
// up from one service to the next whatever each board's own order (owner, 14-oct-2026). The rest keep
// their order after them.
export function staffAndFlowFirst<I extends { kind: string; col?: ColumnLike }>(items: I[]): I[] {
  const staff = items.filter((i) => i.kind === "col" && i.col && isStaffColumn(i.col));
  const flow = items.filter((i) => i.kind === "flujo");
  return [...staff, ...flow, ...items.filter((i) => !staff.includes(i) && !flow.includes(i))];
}

export function hidePresente<C extends ColumnLike>(cols: C[]): C[] {
  return cols.filter((c) => c.clave !== "presente");
}
