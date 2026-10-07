// Resolución PURA de la ubicación en vivo del paciente (vitales/consulta/servicio). El BE ya
// resolvió la precedencia (quién gana si tiene cita Y sesión abiertas); esto solo decide QUÉ
// etiqueta de mensajes/frontdesk.json pintar para la combinación location×status que llegó.
// Ver docs/specs/ubicacion-en-vivo-del-paciente.md (BE) y HANDOFF-ubicacion-en-vivo-del-paciente.md.

export type UbicacionClave =
  | "enVitales"
  | "enConsultaEsperando"
  | "enConsulta"
  | "enServicioEsperando"
  | "enServicio";

export function claveUbicacion(p: { location: string; status: string }): UbicacionClave {
  if (p.location === "vitales") return "enVitales";
  if (p.location === "consulta") return p.status === "en_consulta" ? "enConsulta" : "enConsultaEsperando";
  return p.status === "en_terapia" ? "enServicio" : "enServicioEsperando";
}

// `from` sucio conocido (citas viejas de un bug ya corregido en el BE que nunca tuvieron hora real
// de llegada): 1970 nunca es una fecha real de "desde cuándo está aquí" — se trata como "sin dato".
export function fechaDesdeValida(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 2000;
}
