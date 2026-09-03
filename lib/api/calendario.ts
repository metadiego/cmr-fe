import { apiFetch } from "./client";

// Calendario de eventos (BE sembrado en prod). Eventos del centro activo + los GLOBALES (esGlobal),
// devueltos por SOLAPAMIENTO del rango y ya ordenados por día y hora. El color/rótulo salen de la
// CATEGORÍA (catálogo del BE); el color es una clave semántica → se mapea a la paleta, no se pinta
// literal. Día calendario + hora de pared (no se convierte por zona). Handoff calendario-eventos-handoff-be-listo.
export interface CalendarioCategoria {
  id: string;
  slug?: string | null;
  name?: string | null;
  labelKey?: string | null;
  color: string; // rojo | azul | violeta | ambar | gris | verde
}
export interface CalendarioEvento {
  id: string;
  clinicId?: string | null;
  day: string; // YYYY-MM-DD (día calendario)
  endDay?: string | null; // último día si dura varios
  time?: string | null; // HH:mm; null = todo el día
  endTime?: string | null;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  isGlobal?: boolean;
  createdBy?: string | null;
  legacyId?: string | null;
}
export interface CrearEventoPayload {
  day: string;
  endDay?: string | null;
  time?: string | null;
  endTime?: string | null;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  isGlobal?: boolean;
  // Solo al CREAR en un centro distinto al de la sesión: el evento nace en ese centro. Sin él, en el de
  // la sesión. Requiere permiso de creación allí (si no, 403). NO se manda al editar.
  centerId?: string | null;
}

// Los centros del selector (leer/escribir) ya NO salen de endpoints por dominio: se piden con el patrón
// único `getCentrosDondePuedo(permiso)` (lib/api/centers). Handoff selector-de-centro-en-la-pantalla.

export function getEventos(desde: string, hasta: string, centroId?: string): Promise<CalendarioEvento[]> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  if (centroId) sp.set("centerId", centroId);
  return apiFetch<CalendarioEvento[]>(`/calendar/events?${sp.toString()}`);
}
export function crearEvento(payload: CrearEventoPayload): Promise<CalendarioEvento> {
  return apiFetch<CalendarioEvento>(`/calendar/events`, { method: "POST", body: JSON.stringify(payload) });
}
export function actualizarEvento(id: string, payload: Partial<CrearEventoPayload>): Promise<CalendarioEvento> {
  return apiFetch<CalendarioEvento>(`/calendar/events/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarEvento(id: string): Promise<unknown> {
  return apiFetch(`/calendar/events/${id}`, { method: "DELETE" });
}
export function getCategorias(): Promise<CalendarioCategoria[]> {
  return apiFetch<CalendarioCategoria[]>(`/calendar/categories`);
}
