import { apiFetch } from "./client";
import type { ConteoPayload } from "@/lib/inventario/conteo-viales";

// Physical count by closed containers per presentation + what is left open (POST
// /inventory/operations/count, permiso inventario.ajustar). The BE converts to the base measure and, if
// the count differs from the system, posts the adjustment itself. Handoff contar-en-viales-handoff-fe.
// The response is not declared in Swagger (201 Record<string, never>): typed from the real answer.
// `contado`/`sistema` arrive in Spanish in v2 on purpose (global glossary shared with the cash count).
export interface ConteoResultado {
  contado: number;
  sistema: number;
  difference: number;
  breakdown?: { presentationId: string; presentation: string; containers: number; inBaseMeasure: number }[];
  ajuste?: unknown;
}

export function contarExistencias(payload: ConteoPayload, centroId?: string | null): Promise<ConteoResultado> {
  return apiFetch<ConteoResultado>(`/inventory/operations/count`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
