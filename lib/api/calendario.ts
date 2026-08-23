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

// Los centros del selector (leer/escribir) ya NO salen de endpoints por dominio: se piden con el patrón
// único `getCentrosDondePuedo(permiso)` (lib/api/centers). Handoff selector-de-centro-en-la-pantalla.

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
