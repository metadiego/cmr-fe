import { apiFetch } from "./client";

// Day-view of medical appointments (call-center). Endpoint: GET /citas/agenda-dia.
// The response is not typed in Swagger, so we model the verified contract here.

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

export interface NotaDia {
  id: string;
  fecha: string;
  contenido: string;
  autorId?: string | null;
  activo: boolean;
  createdAt?: string;
}

export interface TipoFranja {
  tipoCitaId: string;
  tipoClave: string;
  tipoNombre: string;
  cupo: number;
  vacios: number; // empty slots to render as "Agendar" buttons
  citas: CitaFila[];
}

export interface Franja {
  hora: string | null; // null = appointments with no time (legacy)
  tipos: TipoFranja[];
}

export interface ResumenDia {
  totalCitas: number;
  porTipo: Record<string, number>;
  cupoTotal: Record<string, number>;
  atendidas: number;
  noShow: number;
}

export interface FestivoDia {
  fecha: string;
  nombre: string;
  bloqueaAgenda: boolean;
}

export interface CentroDia {
  clinicId: string;
  nombre: string;
  notasDia: NotaDia[];
  festivos: FestivoDia[];
  bloqueado: boolean; // holiday with bloqueaAgenda → day closed (cupo/vacios all 0)
  franjas: Franja[];
  resumen: ResumenDia;
}

export interface AgendaDia {
  fecha: string;
  columnas: ColumnaEfectiva[];
  centros: CentroDia[];
}

// GET /citas/agenda-dia?fecha&centroId?
// - centroId set → that center (tenant forced to it).
// - combinado=true → omit X-Tenant-ID → BE returns ALL permitted centers.
// - neither → the active center (cookie/clinic).
export function getAgendaDia(
  fecha: string,
  opts: { centroId?: string; combinado?: boolean } = {},
): Promise<AgendaDia> {
  const sp = new URLSearchParams({ fecha });
  if (opts.centroId) sp.set("centroId", opts.centroId);
  const tenant = opts.combinado ? null : (opts.centroId ?? undefined);
  return apiFetch<AgendaDia>(`/citas/agenda-dia?${sp.toString()}`, {}, tenant);
}
