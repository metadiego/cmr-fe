import type { components } from "./schema";
import { apiFetch } from "./client";

// Historial crudo de una sesión (append-only, `frontdesk_eventos`): cada transición queda con su
// `actorId` — el usuario LOGUEADO que la hizo, no el enfermero/técnico asignado a la fila. Lo pidió
// el dueño (06-nov-2026): el responsable de un "En terapia" sin cerrar es quien lo dejó así trabajando,
// no quien figura en el select de enfermera. GET /frontdesk/sesiones/:id/historial.
export type FrontdeskEvento = components["schemas"]["FrontdeskEventoEntity"];

export function getHistorialSesion(sesionId: string, centroId?: string): Promise<FrontdeskEvento[]> {
  return apiFetch<FrontdeskEvento[]>(`/frontdesk/sesiones/${sesionId}/historial`, {}, centroId);
}
