import { apiFetch } from "./client";

// Estadísticas de Servicios (BE PRs #212/#213). Una sola llamada trae la matriz GENERAL (personal ×
// servicio) y el desglose por servicio (bloques por rol). Contrato: cmr-be/docs/specs/estadisticas-servicios.md.
// Permiso estadisticas.read (admin/super_admin/gerente). Tenant-scoped por X-Tenant-ID (centro activo).

// Fila de la matriz GENERAL: un miembro del personal y sus participaciones por servicio (solo las claves
// con valor; las ausentes son 0). `personalId: null` + nombre "Sin asignar" = visita sin esa persona.
// `porServicio` y `participaciones` NO están en el mapa → el BE los devuelve en español.
export type EstGeneralFila = {
  staffId: string | null;
  name: string;
  porServicio: Record<string, number>;
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
};
// Un rol dentro de un servicio (enfermera, tecnico…). `participaciones` es el DIVISOR de los porcentajes.
export type EstRol = {
  role: string;
  participaciones: number; // NO en el mapa → queda en español
  rows: EstRolFila[]; // la clave `filas` se traduce a `rows`, pero su CONTENIDO no (bolsa opaca)
};
export type EstServicio = {
  slug: string;
  name: string;
  sessions: number;
  participaciones: number; // NO en el mapa → queda en español
  patients: number;
  roles: EstRol[]; // [] = el servicio no registró rol en el periodo (solo resumen)
};
export type EstadisticasServicios = {
  // `general` y `serviciosActivos` NO están en el mapa → quedan en español.
  totals: { sessions: number; patients: number; participaciones: number; serviciosActivos: number };
  general: EstGeneralFila[]; // ya ordenada por total desc
  services: EstServicio[]; // todos los del catálogo; pintar como pestaña los de sesiones > 0
};

// Estadísticas DIARIAS (el cierre del gerente, BE PR #260). Tres bloques + total, por centro de la sesión.
// `nuevas`/`seguimientos` = citas ATENDIDAS (no agendadas); `aplicados` = sesiones ENTREGADAS ese día;
// `vendidos` = sesiones que prometieron las FACTURAS del día (no coinciden, y está bien). `ingresoBruto`
// sale del MISMO sitio que el cuadre de caja → NO recalcular sumando la tabla (la tabla cuenta sesiones).
// Solo vienen servicios con actividad (el BE no manda ceros); orden por nombre → respetar.
export type EstDiariaServicio = { slug: string; name: string; applied: number; sold: number };
export type EstadisticasDiarias = {
  medicalCare: { newCount: number; followUpCount: number; total: number };
  services: EstDiariaServicio[];
  grossRevenue: number;
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
export function getEstadisticasServicios(
  desde: string,
  hasta: string,
  centroId?: string,
): Promise<EstadisticasServicios> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  return apiFetch<EstadisticasServicios>(`/statistics/services?${sp.toString()}`, {}, centroId);
}
