import { apiFetch } from "./client";

// Prescripción del modal AP-Board (BE PR #36). Plug-and-play: si `grupos` viene
// vacío/404, el FE oculta la sección. El BE sella paciente/médico/día/usuario.

export interface GrupoPrescripcion {
  clave: string; // "SUEROTERAPIA"
  labelKey: string; // "prescripcion.grupo.sueroterapia" (fallback humanizado)
  tipo: string; // "servicio" | …
  orden: number;
}
export interface CatalogoPrescripcion {
  grupos: GrupoPrescripcion[];
  kits: unknown[];
  componentes: unknown[];
}
export interface PrescripcionCita {
  registros: Record<string, number>; // { [grupoClave]: cantidad }
  noPrescripcion: boolean;
  resuelto: boolean; // autoridad del BE: noPrescripcion || (∃ grupo con cantidad>0)
}

// Todo tenant-scoped: pasar centroId para el X-Tenant-ID de la petición.
export function getCatalogoPrescripcion(centroId?: string): Promise<CatalogoPrescripcion> {
  return apiFetch<CatalogoPrescripcion>(`/prescripcion/catalogo`, {}, centroId);
}

export function getPrescripcionCita(citaId: string, centroId?: string): Promise<PrescripcionCita> {
  return apiFetch<PrescripcionCita>(`/prescripcion/cita/${citaId}`, {}, centroId);
}

// Upsert por celda (debounced en el FE). El BE deriva `checked` de la cantidad.
export function setPrescripcionCelda(
  citaId: string,
  grupoClave: string,
  cantidad: number,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/prescripcion/cita/${citaId}`,
    { method: "POST", body: JSON.stringify({ grupoClave, cantidad }) },
    centroId,
  );
}

// Checkbox "No se prescribió nada al paciente".
export function setNoPrescripcion(citaId: string, on: boolean, centroId?: string): Promise<unknown> {
  return apiFetch(
    `/prescripcion/cita/${citaId}/no-prescripcion`,
    { method: "POST", body: JSON.stringify({ on }) },
    centroId,
  );
}
