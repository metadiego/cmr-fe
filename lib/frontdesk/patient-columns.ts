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
// The session counter (e.g. 2/3), right after the flow in every service (owner, 14-oct-2026).
export const isSessionColumn = (c: ColumnLike) => c.clave === "fd_sesiones";

// Every service block starts with the same three columns — who performs it, the flow, the session
// counter — so they line up from one service to the next whatever each board's own order (owner,
// 14-oct-2026). The rest keep their order after them.
export function staffAndFlowFirst<I extends { kind: string; col?: ColumnLike }>(items: I[]): I[] {
  const staff = items.filter((i) => i.kind === "col" && i.col && isStaffColumn(i.col));
  const flow = items.filter((i) => i.kind === "flujo");
  const session = items.filter((i) => i.kind === "col" && i.col && isSessionColumn(i.col));
  const lead = [...staff, ...flow, ...session];
  return [...lead, ...items.filter((i) => !lead.includes(i))];
}

// The consultation's counterpart of staffAndFlowFirst: the doctor first, then its flow (the grouped
// toggles, render.group), then the rest — so it lines up with the services' «técnico/enfermera · flujo»
// (owner, 14-oct-2026). The flow stays one contiguous run, which is how the board groups it.
export function doctorAndFlowFirst<C extends ColumnLike>(cols: C[]): C[] {
  const isFlow = (c: C) => !!(c.render as { group?: string } | null)?.group;
  const doctor = cols.filter((c) => c.clave === "medico");
  const flow = cols.filter(isFlow);
  const lead = [...doctor, ...flow];
  return [...lead, ...cols.filter((c) => !lead.includes(c))];
}

export function hidePresente<C extends ColumnLike>(cols: C[]): C[] {
  return cols.filter((c) => c.clave !== "presente");
}
