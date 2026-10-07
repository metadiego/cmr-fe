import { apiFetch } from "./client";

// PATCH /frontdesk/patients/:pacienteId/services/:servicioId/session-count — fija/corrige el conteo de
// sesiones del paciente en el servicio SIN que exista ningún paquete previo (opt-in por servicio vía
// `servicio.allowSessionFixWithoutPackage`; 400 si está apagado). Si el paciente YA tiene un paquete
// pendiente, el BE actualiza ESE en vez de crear uno nuevo (mismo resultado que "Corregir
// disponibilidad"). Cualquier `sesionesTotales` ≥ 0 es válido — avisar, nunca bloquear, igual que
// `fd_aplicadas`. `productoId` es obligatorio solo si el servicio es de GRUPO (productId propio null +
// billingGroupId no null) y el paciente no tiene paquete: hay que indicar a qué producto del grupo
// anclar el paquete nuevo. Handoff HANDOFF-sesiones-sin-paquete-listo.md /
// docs/specs/columna-sesiones-sin-paquete-handoff-be.md.
export type FijarSesionesSinPaquetePayload = {
  sesionesTotales: number;
  actorId?: string;
  productoId?: string;
};
export function fijarSesionesSinPaquete(
  pacienteId: string,
  servicioId: string,
  payload: FijarSesionesSinPaquetePayload,
  centroId?: string,
): Promise<void> {
  return apiFetch<void>(
    `/frontdesk/patients/${encodeURIComponent(pacienteId)}/services/${encodeURIComponent(servicioId)}/session-count`,
    { method: "PATCH", body: JSON.stringify(payload) },
    centroId,
  );
}
