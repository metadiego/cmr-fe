import { apiFetch } from "./client";

// Enganche con el EHR externo (cmr-ehr): al marcar PRESENTE en el tablero de Atención, el paciente
// queda también allá (se crea si no existe + se registra la llegada), lo hace el BE. El FE solo:
//  1) respeta el interruptor por centro (si está apagado, no pide nada ni bloquea),
//  2) comprueba que el paciente tiene los 5 datos que el EHR exige y, si falta alguno, bloquea Presente
//     con un modal hasta completarlos.
// Contrato: .personal/be-ehr-integration-presente-handoff.md. Diseño «enchufe»: apagado = inerte.

// Los 5 datos que exige el EHR. Las claves coinciden con campos de la ficha del paciente.
export type EhrReadinessField = "idType" | "docId" | "sexo" | "fechaNacimiento" | "zipcode";

// GET /ehr-integration/patients/:id/readiness — ¿tiene los 5 datos? Permiso ehr-integration.read.
export interface EhrReadiness {
  listo: boolean;
  faltantes: EhrReadinessField[];
}
export function getEhrReadiness(patientId: string, centroId?: string): Promise<EhrReadiness> {
  return apiFetch<EhrReadiness>(`/ehr-integration/patients/${patientId}/readiness`, {}, centroId);
}

// GET/PUT /ehr-integration/config — el interruptor por centro. Sin fila para un centro = apagado.
// Permiso ehr-integration.config. Aceptan ?centerIds= para resolver permiso contra otros centros.
export interface EhrConfig {
  habilitado: boolean;
}
function centerQs(centerIds?: string[]): string {
  if (!centerIds?.length) return "";
  return "?" + centerIds.map((id) => `centerIds=${encodeURIComponent(id)}`).join("&");
}
export function getEhrConfig(centroId?: string, centerIds?: string[]): Promise<EhrConfig> {
  return apiFetch<EhrConfig>(`/ehr-integration/config${centerQs(centerIds)}`, {}, centroId);
}
export function setEhrConfig(habilitado: boolean, centroId?: string, centerIds?: string[]): Promise<EhrConfig> {
  return apiFetch<EhrConfig>(
    `/ehr-integration/config${centerQs(centerIds)}`,
    { method: "PUT", body: JSON.stringify({ habilitado }) },
    centroId,
  );
}

// Lectura del interruptor TOLERANTE a que el BE aún no esté desplegado (hoy responde 404): cualquier
// fallo → apagado. Así el enganche nace inerte y nunca rompe Presente hasta que el BE exista y alguien
// lo encienda. Es el «enchufe» del handoff (apagado y no pasa nada).
export async function isEhrEnabled(centroId?: string): Promise<boolean> {
  try {
    const cfg = await getEhrConfig(centroId);
    return !!cfg.habilitado;
  } catch {
    return false;
  }
}
