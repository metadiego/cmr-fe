import type { components } from "./schema";
import { apiFetch } from "./client";

// Config de facturación para el POS: columnas de captura por producto, medios (referencia)
// y médicos. Todo verificado en prod (handoff fe-facturacion-general-pos-handoff, def.).

// Esquema de columnas de la LÍNEA para un producto. `rol` decide semántica; `tipo` decide input.
// multiplicador → entra al total (server calcula); informativo → se muestra, no afecta total.
export type ColumnaFacturacion = components["schemas"]["ColumnaFacturacionEntity"];
export function listColumnasFacturacion(
  productoId: string,
  centro?: string,
): Promise<ColumnaFacturacion[]> {
  return apiFetch<ColumnaFacturacion[]>(
    `/facturacion/columnas?productoId=${encodeURIComponent(productoId)}`,
    {},
    centro,
  );
}

// Medios / referencia (mide publicidad). Respuesta no tipada como entidad → shape mínima.
export interface MedioFacturacion {
  id: string;
  nombre: string;
  activo?: boolean;
}
export function listMedios(centro?: string): Promise<MedioFacturacion[]> {
  return apiFetch<MedioFacturacion[]>(`/facturacion/medios`, {}, centro);
}

// Médicos (personal con capacidad médico) para el "Médico tratante".
export interface MedicoOpcion {
  id: string;
  nombre: string;
}
export function listMedicos(centro?: string): Promise<MedicoOpcion[]> {
  return apiFetch<MedicoOpcion[]>(`/personal/por-capacidad/medico`, {}, centro);
}
