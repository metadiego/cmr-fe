import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";

// Estadísticas de Servicios (BE PRs #212/#213). Una sola llamada trae la matriz GENERAL (personal ×
// servicio) y el desglose por servicio (bloques por rol). Contrato: cmr-be/docs/specs/estadisticas-servicios.md.
// Permiso estadisticas.read (admin/super_admin/gerente).
// Services: every clinic where the person holds estadisticas.read, narrowed by `centerIds`. Daily: one clinic.

// Fila de la matriz GENERAL: un miembro del personal y sus participaciones por servicio (solo las claves
// con valor; las ausentes son 0). `personalId: null` + nombre "Sin asignar" = visita sin esa persona.
// `byService` SÍ se traduce al inglés en /api/v2 (verificado live 1-oct; el comentario viejo decía lo
// contrario y por eso el FE leía `porServicio` y la matriz salía vacía/rompía). Sus CLAVES internas (slug del
// servicio) son datos y no se traducen. `participaciones` dentro de los bloques de rol sigue en español.
export type EstGeneralFila = {
  staffId: string | null;
  name: string;
  byService: Record<string, number>;
  total: number;
};
// Fila dentro de un bloque de rol. `porcentaje` ya viene redondeado a 2 decimales y cada bloque suma 100.
// OJO: estas filas viajan dentro de `filas` (bolsa OPACA) → sus claves NO se traducen: quedan en español.
export type EstRolFila = {
  posicion: number;
  personalId: string | null;
  nombre: string;
  participaciones: number;
  pacientes: number;
  porcentaje: number;
  // BE #554: units applied (areas in laser, doses in Vit C, 1 per visit elsewhere) and their share.
  therapies?: number;
  therapiesShare?: number;
};
// Un rol dentro de un servicio (enfermera, tecnico…). `participaciones` es el DIVISOR de los porcentajes.
export type EstRol = {
  role: string;
  participaciones: number; // NO en el mapa → queda en español
  therapies?: number; // BE #554: the role's total units
  rows: EstRolFila[]; // la clave `filas` se traduce a `rows`, pero su CONTENIDO no (bolsa opaca)
};
export type EstVitalesFila = { position: number; staffId: string | null; name: string; takings: number; patients: number; share: number };
export type EstVitales = { takings: number; patients: number; rows: EstVitalesFila[] };
export type EstServicio = {
  slug: string;
  name: string;
  sessions: number;
  participaciones: number; // NO en el mapa → queda en español
  patients: number;
  therapies?: number; // BE #554
  roles: EstRol[]; // [] = el servicio no registró rol en el periodo (solo resumen)
};
export type EstadisticasServicios = {
  // `general` y `serviciosActivos` NO están en el mapa → quedan en español.
  totals: { sessions: number; patients: number; participaciones: number; serviciosActivos: number; therapies?: number };
  // BE #554: vitals taken by each nurse at the medical appointments (the «Vitales» tab).
  vitals?: EstVitales | null;
  general: EstGeneralFila[]; // ya ordenada por total desc
  services: EstServicio[]; // todos los del catálogo; pintar como pestaña los de sesiones > 0
};

// Estadísticas DIARIAS (el cierre del gerente, BE PR #260). Tres bloques + total, por centro de la sesión.
// `nuevas`/`seguimientos` = citas ATENDIDAS (no agendadas); `aplicados` = sesiones ENTREGADAS ese día;
// `vendidos` = sesiones que prometieron las FACTURAS del día (no coinciden, y está bien). `ingresoBruto`
// sale del MISMO sitio que el cuadre de caja → NO recalcular sumando la tabla (la tabla cuenta sesiones).
// Solo vienen servicios con actividad (el BE no manda ceros); orden por nombre → respetar.
// BE #541: `returned` = sessions given back by that day's refunds; `refunds`/`netRevenue` count refunds on
// their refund date (net = the day's cash count).
// BE #563: `applied` stopped being a patient count back at BE #551 (it is units — same drift the sibling
// report already had, see EstServicio.therapies below). `visits` is the real patient/session count;
// `therapies` is the units (areas in laser, doses in Vit C/Intravenoso where the service declares
// `statisticsUnitKey`, 1 per visit elsewhere) — same figure as `/estadisticas/servicios`'s `therapies`.
// Always present (0 when nothing happened). Screen: dailyRowShowsUnits (lib/estadisticas/services.ts).
export type EstDiariaServicio = {
  slug: string;
  name: string;
  applied: number;
  sold: number;
  returned?: number;
  visits: number;
  therapies: number;
};
export type EstadisticasDiarias = {
  medicalCare: { newCount: number; followUpCount: number; total: number };
  services: EstDiariaServicio[];
  grossRevenue: number;
  refunds?: number;
  netRevenue?: number;
};
// GET /estadisticas/diarias?desde=YYYY-MM-DD[&hasta] — `hasta` opcional (por defecto = `desde`, un día).
export function getEstadisticasDiarias(
  desde: string,
  hasta?: string,
  centroId?: string | null,
): Promise<EstadisticasDiarias> {
  const sp = new URLSearchParams({ from: desde });
  if (hasta) sp.set("to", hasta);
  return apiFetch<EstadisticasDiarias>(`/statistics/daily?${sp.toString()}`, {}, centroId);
}

// GET /estadisticas/servicios?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — general + todas las pestañas en una.
export async function getEstadisticasServicios(
  desde: string,
  hasta: string,
  choice?: CenterChoice,
): Promise<EstadisticasServicios> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  // `choice`: the report's clinic filter (null = every clinic with estadisticas.read; the BE sums them).
  return apiFetch<EstadisticasServicios>(await oneCenterPath(`/statistics/services?${sp.toString()}`, choice), {}, tenantOf(choice));
}
