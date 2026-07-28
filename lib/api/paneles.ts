import { apiFetch, apiFetchEnvelope } from "./client";

// Paneles operativos (data-driven). El primero: Panel de Enfermería (vitales/intravenoso).
// Contrato: /api/v1/paneles/* (tag `paneles`). Realtime por SSE /frontdesk/stream
// (entidad "panel_notificacion", accion "notificada"|"aceptada"). RBAC panel.read/notificar/aceptar/config.
// El BE nunca manda texto visible: solo `labelKey` (i18n en el FE).

export type PanelSeccion = {
  id: string;
  clave: string;
  labelKey: string;
  orden: number;
  color: string;
  visible: boolean; // false → franja de color sin número (paridad legacy)
  audio: string | null; // nombre del sonido de alarma para esta sección
  capacidad?: string | null;
  asignaA?: string | null; // p. ej. sesion.enfermeraId
  activo: boolean;
};
export type PanelPersonal = { id: string; nombre: string };
export type PanelEstatus = {
  personalId: string;
  statusTipoId?: string | null;
  labelKey?: string | null;
  label?: string | null;
  color?: string | null;
};
export type PanelDefinicion = {
  panel: { clave: string; labelKey: string; layout: string; config: Record<string, unknown> | null };
  secciones: PanelSeccion[];
  personal: PanelPersonal[];
  estatus: PanelEstatus[];
};

export type PanelNotificacion = {
  id: string;
  seccion: string;
  color?: string | null;
  audio?: string | null;
  sesionId?: string | null;
  pacienteId?: string | null;
  pacienteNombre?: string | null;
  record?: string | null;
  servicioNombre?: string | null;
  aceptadaPorId?: string | null;
  createdAt?: string;
};

export type PanelContador = { personalId: string; total: number; porSeccion: Record<string, number> };

// GET /paneles/:clave/definicion — UNA llamada: panel + secciones + personal + estatus vivo.
export function getPanelDefinicion(clave: string, centroId?: string): Promise<PanelDefinicion> {
  return apiFetch<PanelDefinicion>(`/paneles/${clave}/definicion`, {}, centroId);
}

// GET /paneles/:clave/notificaciones — avisos pendientes al abrir la pantalla.
export function getPanelNotificaciones(clave: string, centroId?: string): Promise<PanelNotificacion[]> {
  return apiFetch<unknown>(`/paneles/${clave}/notificaciones`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelNotificacion[]) : (((r as { items?: PanelNotificacion[] })?.items) ?? []),
  );
}

// POST /paneles/:clave/notificar — lo llama la campana. Idempotente (doble toque no duplica).
export function notificarPanel(
  clave: string,
  payload: { seccion: string; sesionId: string },
  centroId?: string,
): Promise<PanelNotificacion> {
  return apiFetch<PanelNotificacion>(
    `/paneles/${clave}/notificar`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// POST /paneles/notificaciones/:id/aceptar — la enfermera toca su tarjeta. Idempotente: si otra la
// tomó, responde 200 con `aceptadaPorId` de la primera (el FE solo refresca, no muestra error).
export async function aceptarNotificacion(
  id: string,
  personalId: string,
  centroId?: string,
): Promise<PanelNotificacion> {
  const env = await apiFetchEnvelope<PanelNotificacion>(`/paneles/notificaciones/${id}/aceptar`, {
    method: "POST",
    body: JSON.stringify({ personalId }),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return env.data;
}

// GET /paneles/:clave/contadores?fecha=YYYY-MM-DD — contadores del día por persona (NO se llevan en el FE).
export function getPanelContadores(clave: string, fecha: string, centroId?: string): Promise<PanelContador[]> {
  return apiFetch<unknown>(`/paneles/${clave}/contadores?fecha=${fecha}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelContador[]) : (((r as { items?: PanelContador[] })?.items) ?? []),
  );
}
