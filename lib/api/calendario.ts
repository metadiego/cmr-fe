import { apiFetch } from "./client";

// Calendario de eventos (BE sembrado en prod). Eventos del centro activo + los GLOBALES (esGlobal),
// devueltos por SOLAPAMIENTO del rango y ya ordenados por día y hora. El color/rótulo salen de la
// CATEGORÍA (catálogo del BE); el color es una clave semántica → se mapea a la paleta, no se pinta
// literal. Día calendario + hora de pared (no se convierte por zona). Handoff calendario-eventos-handoff-be-listo.
export interface CalendarioCategoria {
  id: string;
  clave?: string | null;
  nombre?: string | null;
  labelKey?: string | null;
  color: string; // rojo | azul | violeta | ambar | gris | verde
}
export interface CalendarioEvento {
  id: string;
  clinicId?: string | null;
  dia: string; // YYYY-MM-DD (día calendario)
  diaFin?: string | null; // último día si dura varios
  hora?: string | null; // HH:mm; null = todo el día
  horaFin?: string | null;
  titulo: string;
  descripcion?: string | null;
  categoriaId?: string | null;
  esGlobal?: boolean;
  creadoPor?: string | null;
  legacyId?: string | null;
}
export interface CrearEventoPayload {
  dia: string;
  diaFin?: string | null;
  hora?: string | null;
  horaFin?: string | null;
  titulo: string;
  descripcion?: string | null;
  categoriaId?: string | null;
  esGlobal?: boolean;
  // Solo al CREAR en un centro distinto al de la sesión: el evento nace en ese centro. Sin él, en el de
  // la sesión. Requiere permiso de creación allí (si no, 403). NO se manda al editar.
  centroId?: string | null;
}

// Centros cuyo calendario puede VER quien pregunta (con nombre). NO usar auth/me/centros: esa trae
// todos los centros de la persona y en algunos no puede ver el calendario → el selector ofrecería
// opciones que dan 403. Uno solo → la pantalla no enseña selector. Handoff calendario-selector-de-centro.
export interface CalendarioCentro {
  id: string;
  nombre: string;
  codigo?: string | null;
}
export function getCentrosCalendario(): Promise<CalendarioCentro[]> {
  return apiFetch<CalendarioCentro[]>(`/calendario/centros`);
}
// Centros donde quien pregunta puede CREAR (filtrado por el permiso de creación). Con esto se decide
// enseñar «Nuevo evento» / permitir editar-borrar: el modo lectura sale del PERMISO, no de si el centro
// es el suyo (alguien puede tener escritura concedida en otro centro). Handoff calendario-selector-de-centro.
export function getCentrosEscrituraCalendario(): Promise<CalendarioCentro[]> {
  return apiFetch<CalendarioCentro[]>(`/calendario/centros/escritura`);
}

export function getEventos(desde: string, hasta: string, centroId?: string): Promise<CalendarioEvento[]> {
  const sp = new URLSearchParams({ desde, hasta });
  if (centroId) sp.set("centroId", centroId);
  return apiFetch<CalendarioEvento[]>(`/calendario/eventos?${sp.toString()}`);
}
export function crearEvento(payload: CrearEventoPayload): Promise<CalendarioEvento> {
  return apiFetch<CalendarioEvento>(`/calendario/eventos`, { method: "POST", body: JSON.stringify(payload) });
}
export function actualizarEvento(id: string, payload: Partial<CrearEventoPayload>): Promise<CalendarioEvento> {
  return apiFetch<CalendarioEvento>(`/calendario/eventos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarEvento(id: string): Promise<unknown> {
  return apiFetch(`/calendario/eventos/${id}`, { method: "DELETE" });
}
export function getCategorias(): Promise<CalendarioCategoria[]> {
  return apiFetch<CalendarioCategoria[]>(`/calendario/categorias`);
}
