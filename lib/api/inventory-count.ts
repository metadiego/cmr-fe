import type { components } from "./schema";
import { apiFetch } from "./client";

// Physical count by closed containers per presentation + what is left open (POST
// /inventory/operations/count, permiso inventario.ajustar). The BE converts to the base measure and, if
// the count differs from the system, posts the adjustment itself, with `notes` heading its note.
// `contado`/`sistema` arrive in Spanish in v2 on purpose (global glossary shared with the cash count).
// Handoffs contar-en-viales-handoff-fe, count-notes-and-swagger-handoff-be.
export type ConteoBody = components["schemas"]["ConteoFisicoDto"];
export type ConteoResultado = components["schemas"]["PhysicalCountResponseDto"];

export function contarExistencias(payload: ConteoBody, centroId?: string | null): Promise<ConteoResultado> {
  return apiFetch<ConteoResultado>(`/inventory/operations/count`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
