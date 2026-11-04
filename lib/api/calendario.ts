import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";

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
  // The event's clinic name (cmr-be clinic-read-scope); null on company-wide events.
  clinicName?: string | null;
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
  // Projected staff absence (Disponibilidad tab in /configuration/staff), not a real calendar_events
  // row: `id` is "absence:<uuid>" and PUT/DELETE on it 404s — edit only from Disponibilidad.
  origin?: "staff_absence" | null;
  sourceId?: string | null;
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
  // Only when CREATING: the clinic the event is born in (calendario.create there, else 403). Without it,
  // the session's. Never sent on edit: an event stays in its clinic.
  centerId?: string | null;
}

// Los centros del selector (leer/escribir) ya NO salen de endpoints por dominio: se piden con el patrón
// único `getCentrosDondePuedo(permiso)` (lib/api/centers). Handoff selector-de-centro-en-la-pantalla.

// The events of every clinic in `choice` (CenterChoice: `null` = every clinic where the person holds
// calendario.read, the clinic filter's ids, or one clinic) PLUS the company-wide ones, which every clinic sees.
export async function getEventos(desde: string, hasta: string, choice: CenterChoice): Promise<CalendarioEvento[]> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  return apiFetch<CalendarioEvento[]>(await oneCenterPath(`/calendar/events?${sp.toString()}`, choice), {}, tenantOf(choice));
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
