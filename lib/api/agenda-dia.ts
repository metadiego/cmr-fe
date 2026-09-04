import { apiFetch } from "./client";

// Day-view of medical appointments (call-center). Endpoint: GET /appointments/day-agenda.
// The response is not typed in Swagger, so we model the verified contract here.
// NOTA api-ingles: varios campos de esta respuesta NO están en el mapa (campos.ts) y el BE
// los sirve TAL CUAL en español: `notasDia`, `bloqueado`, `franjas`, `resumen`, `tipoClave`,
// `tipoNombre`, `cupo`, `vacios`, `totalCitas`, `porTipo`, `cupoTotal`, `atendidas`, `noShow`.
// Sus CONTENEDORES no-opacos (franjas/resumen) sí recursan → las claves internas que SÍ están
// en el mapa (hora→time, tipos→types, tipoCitaId→appointmentTypeId, citas→appointments,
// fecha→date, nombre→name) llegan en inglés. `columnas`→`columns` es OPACO: su contenido
// (ColumnaEfectiva) queda en español (motor de tableros).

// A dynamic column definition (drives the day-sheet table headers/cells).
export interface ColumnaEfectiva {
  clave: string; // key into each row of citas[]
  labelKey: string; // i18n header key
  // Nombre PROPIO del negocio para esta columna en ESTE tablero (render.label): se pinta tal cual,
  // NO se traduce ni capitaliza. null/ausente = usar labelKey. Handoff nombre-de-columna-por-servicio.
  label?: string | null;
  // Ya RESUELTO por el BE contra la entidad del tablero: "cita.acciones" en Atención,
  // "sesion.acciones" en un servicio. Es lo que permite que una columna sirva en todos los tableros.
  binding?: string;
  tipo: string; // "texto" | "hora" | "badge" | "toggle" | "accion" | ...
  editable: boolean;
  permiso: string | null;
  render: Record<string, unknown> | null;
  orden: number;
  fijo: boolean; // sticky column
  color?: string | null; // admin pre-personalization (definicion.color); null = default
}

// A projected appointment row: values keyed by column clave (+ id/estado).
export type CitaFila = { id: string; estado?: string } & Record<string, unknown>;

// Una nota del día (dentro del contenedor español `notasDia`; el contenido SÍ se traduce).
export interface NotaDia {
  id: string;
  date: string;
  content: string;
  authorId?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface TipoFranja {
  appointmentTypeId: string;
  tipoClave: string; // NO está en el mapa → español
  tipoNombre: string; // NO está en el mapa → español
  cupo: number; // NO está en el mapa → español
  vacios: number; // NO está en el mapa → español (empty slots → "Agendar" buttons)
  citas: CitaFila[]; // clave `citas`→`appointments` en la respuesta
}

export interface Franja {
  time: string | null; // null = appointments with no time (legacy)
  tipos: TipoFranja[]; // clave `tipos`→`types` en la respuesta
}

// `resumen` y todos sus campos NO están en el mapa → llegan en español.
export interface ResumenDia {
  totalCitas: number;
  porTipo: Record<string, number>;
  cupoTotal: Record<string, number>;
  atendidas: number;
  noShow: number;
}

export interface FestivoDia {
  date: string;
  name: string;
  blocksSchedule: boolean;
}

export interface CentroDia {
  clinicId: string;
  name: string;
  notasDia: NotaDia[]; // contenedor `notasDia` NO está en el mapa → clave en español
  festivos: FestivoDia[]; // clave `festivos`→`holidays` en la respuesta
  bloqueado: boolean; // NO está en el mapa → español (holiday closes the day)
  franjas: Franja[]; // contenedor `franjas` NO está en el mapa → clave en español
  resumen: ResumenDia; // contenedor `resumen` NO está en el mapa → clave en español
}

export interface AgendaDia {
  date: string;
  columns: ColumnaEfectiva[]; // `columnas`→`columns` (OPACO: contenido en español)
  centers: CentroDia[]; // `centros`→`centers`
}

// GET /appointments/day-agenda?date&centerId?
// - centroId set → that center (tenant forced to it).
// - combinado=true → omit X-Tenant-ID → BE returns ALL permitted centers.
// - neither → the active center (cookie/clinic).
export function getAgendaDia(
  fecha: string,
  opts: { centroId?: string; combinado?: boolean } = {},
): Promise<AgendaDia> {
  const sp = new URLSearchParams({ date: fecha });
  if (opts.centroId) sp.set("centerId", opts.centroId);
  const tenant = opts.combinado ? null : (opts.centroId ?? undefined);
  return apiFetch<AgendaDia>(`/appointments/day-agenda?${sp.toString()}`, {}, tenant);
}
