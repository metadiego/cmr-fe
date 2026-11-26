// Resolución PURA de la ubicación en vivo del paciente (vitales/consulta/servicio). El BE ya
// resolvió la precedencia (quién gana si tiene cita Y sesión abiertas); esto solo decide QUÉ
// etiqueta de mensajes/frontdesk.json pintar para la combinación location×status que llegó.
// Ver docs/specs/ubicacion-en-vivo-del-paciente.md (BE) y HANDOFF-ubicacion-en-vivo-del-paciente.md.

import { rowInGroups, type StagedRow } from "../lifecycle/stage-groups.ts";

export type UbicacionClave =
  | "enVitales"
  | "enConsultaEsperando"
  | "enConsulta"
  | "enServicioEsperando"
  | "enServicio";

// The location decides the kind (consultation = medical, service = therapy); the row's stage group
// decides whether the patient is being seen (in_consultation / in_therapy) or still waiting. The
// live-location row carries only the old status, so its stages are derived from it.
export function claveUbicacion(p: StagedRow & { location: string; status: string }): UbicacionClave {
  if (p.location === "vitales") return "enVitales";
  if (p.location === "consulta")
    return rowInGroups("medical", p, ["in_consultation"]) ? "enConsulta" : "enConsultaEsperando";
  return rowInGroups("therapy", p, ["in_therapy"]) ? "enServicio" : "enServicioEsperando";
}

// `from` sucio conocido (citas viejas de un bug ya corregido en el BE que nunca tuvieron hora real
// de llegada): 1970 nunca es una fecha real de "desde cuándo está aquí" — se trata como "sin dato".
export function fechaDesdeValida(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 2000;
}
