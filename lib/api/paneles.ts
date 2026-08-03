import { apiFetch, apiFetchEnvelope } from "./client";

// Paneles operativos (data-driven). El primero: Panel de Enfermería (vitales/intravenoso).
// Contrato: /api/v1/paneles/* (tag `paneles`). Realtime por SSE /frontdesk/stream
// (entidad "panel_notificacion", accion "notificada"|"aceptada"). RBAC panel.read/notificar/aceptar/config.
// El BE nunca manda texto visible: solo `labelKey` (i18n en el FE).

export type PanelSeccion = {
  id: string;
  panelId?: string;
  clave: string;
  labelKey: string;
  orden: number;
  color: string | null;
  visible: boolean; // false → franja de color sin número (paridad legacy)
  audio: string | null; // nombre del sonido de alarma para esta sección
  capacidad?: string | null; // capacidad del personal que puede tomarla (del personal del centro, NO fija)
  asignaA?: string | null; // lista cerrada: sesion.enfermeraId | sesion.tecnicoId | sesion.medicoId
  origen?: Record<string, unknown> | null; // { tipo:'servicio', servicioId } — pasarela (el BE no lo interpreta aún)
  activo: boolean;
};

// asignaA es una FRONTERA DE SEGURIDAD (decide a qué columna de la sesión se escribe) → lista fija.
export const ASIGNA_A = ["sesion.enfermeraId", "sesion.tecnicoId", "sesion.medicoId"] as const;

// Payloads del CRUD admin. capacidad es `string` a propósito (el BE ya NO la limita a 3 valores:
// valida contra las capacidades reales del personal del centro). El schema.d.ts está desactualizado.
export type CreatePanelSeccionPayload = {
  clave: string;
  labelKey: string;
  orden?: number;
  color?: string | null;
  visible?: boolean;
  audio?: string | null;
  capacidad?: string;
  asignaA?: (typeof ASIGNA_A)[number];
  origen?: Record<string, unknown> | null;
};
export type UpdatePanelSeccionPayload = Partial<CreatePanelSeccionPayload> & { activo?: boolean };
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
  // Contadores del día YA vienen aquí (BE) → no hace falta la llamada aparte a /contadores.
  contadores?: PanelContador[];
};

export type PanelNotificacion = {
  id: string;
  seccionId?: string | null; // el BE devuelve el id; la sección (clave/color/audio) se resuelve con la definición
  sesionId?: string | null;
  pacienteId?: string | null;
  aceptadaPorId?: string | null;
  estado?: string;
  createdAt?: string;
  // Campos de DISPLAY — el BE debería enriquecerlos (hoy no vienen); ver handoff panel-aviso-enriquecido.
  seccion?: string | null;
  color?: string | null;
  audio?: string | null;
  pacienteNombre?: string | null;
  record?: string | null;
  servicioNombre?: string | null;
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

// POST /paneles/notificaciones/:id/cancelar — retira un aviso pendiente (p. ej. el paciente se fue).
// motivo opcional (máx 300). RBAC panel.notificar. IDEMPOTENTE: si ya lo aceptaron devuelve el estado
// actual (NO es error). Emite el mismo evento SSE → la tarjeta desaparece en todas las pantallas.
export function cancelarNotificacion(
  id: string,
  motivo?: string,
  centroId?: string,
): Promise<PanelNotificacion> {
  return apiFetch<PanelNotificacion>(
    `/paneles/notificaciones/${id}/cancelar`,
    { method: "POST", body: JSON.stringify(motivo ? { motivo } : {}) },
    centroId,
  );
}

// GET /paneles/:clave/contadores?fecha=YYYY-MM-DD — contadores del día por persona (NO se llevan en el FE).
export function getPanelContadores(clave: string, fecha: string, centroId?: string): Promise<PanelContador[]> {
  return apiFetch<unknown>(`/paneles/${clave}/contadores?fecha=${fecha}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelContador[]) : (((r as { items?: PanelContador[] })?.items) ?? []),
  );
}

// ─── CRUD admin de secciones (RBAC panel.config; borrar exige además rol admin) ──────────────────
// GET /paneles/:clave/secciones — catálogo. includeInactive=true trae también las apagadas para
// poder reactivarlas (sin él, /definicion filtra activo:true y una sección apagada desaparecía).
export function getPanelSecciones(
  clave: string,
  opts: { includeInactive?: boolean } = {},
  centroId?: string,
): Promise<PanelSeccion[]> {
  const qs = opts.includeInactive ? "?includeInactive=true" : "";
  return apiFetch<unknown>(`/paneles/${clave}/secciones${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelSeccion[]) : (((r as { items?: PanelSeccion[] })?.items) ?? []),
  );
}
export function createPanelSeccion(
  clave: string,
  payload: CreatePanelSeccionPayload,
  centroId?: string,
): Promise<PanelSeccion> {
  return apiFetch<PanelSeccion>(
    `/paneles/${clave}/secciones`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
export function updatePanelSeccion(
  id: string,
  payload: UpdatePanelSeccionPayload,
  centroId?: string,
): Promise<PanelSeccion> {
  return apiFetch<PanelSeccion>(
    `/paneles/secciones/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
// DELETE /paneles/secciones/:id — 409 si tiene histórico (el mensaje trae el conteo): NO es un fallo
// a ocultar, se muestra y se ofrece desactivar. No arrastra histórico a propósito.
export function deletePanelSeccion(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/paneles/secciones/${id}`, { method: "DELETE" }, centroId);
}
// PUT /paneles/:clave/secciones/orden — reordenar en BLOQUE (atómico): manda la lista entera. Si
// algún id no es del panel → 400 y no se aplica ninguno.
export function reordenarSecciones(
  clave: string,
  ordenes: { id: string; orden: number }[],
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/paneles/${clave}/secciones/orden`,
    { method: "PUT", body: JSON.stringify({ ordenes }) },
    centroId,
  );
}
