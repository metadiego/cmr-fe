import { apiFetch, apiFetchEnvelope } from "./client";

// Paneles operativos (data-driven). El primero: Panel de Enfermería (vitales/intravenoso).
// Contrato: /api/v1/paneles/* (tag `paneles`). Realtime por SSE /frontdesk/stream
// (entidad "panel_notificacion", accion "notificada"|"aceptada"). RBAC panel.read/notificar/aceptar/config.
// El BE nunca manda texto visible: solo `labelKey` (i18n en el FE).

// OJO: PanelSeccion viaja dentro de `secciones` (bolsa OPACA) en /definition → sus claves NO se traducen y
// quedan en español. Se mantiene en español TODO el tipo (y los payloads de sección) por coherencia con esa
// bolsa. Sus claves en español pasan íntegras por el middleware de v2 al entrar (ninguna colisiona con un
// nombre inglés del mapa). NOTA (hueco BE): los endpoints /sections (GET/POST/PUT) devuelven la sección a
// NIVEL RAÍZ, donde el interceptor SÍ traduce, así que ahí llegan en inglés — inconsistencia del BE. Ver reporte.
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
export type PanelPersonal = { id: string; name: string };
export type PanelEstatus = {
  staffId: string;
  statusTypeId?: string | null;
  labelKey?: string | null;
  label?: string | null; // NO en el mapa → queda como está (`label`)
  color?: string | null; // se dice igual (CAMPOS_IGUALES)
};
// `estatus` y `contadores` NO están en el mapa → esas claves del contenedor quedan en español.
// `config` es bolsa OPACA → su contenido no se traduce (Record).
export type PanelDefinicion = {
  panel: { slug: string; labelKey: string; layout: string; config: Record<string, unknown> | null };
  sections: PanelSeccion[]; // clave `secciones`→`sections`; contenido opaco (PanelSeccion en español)
  staff: PanelPersonal[]; // clave `personal`→`staff`
  estatus: PanelEstatus[];
  // Contadores del día YA vienen aquí (BE) → no hace falta la llamada aparte a /contadores.
  contadores?: PanelContador[];
};

export type PanelNotificacion = {
  id: string;
  sectionId?: string | null; // el BE devuelve el id; la sección (clave/color/audio) se resuelve con la definición
  sessionId?: string | null;
  patientId?: string | null;
  acceptedById?: string | null;
  status?: string;
  createdAt?: string;
  // Campos de DISPLAY — el BE debería enriquecerlos (hoy no vienen); ver handoff panel-aviso-enriquecido.
  // `seccion`, `pacienteNombre` y `servicioNombre` NO están en el mapa → quedan en español.
  seccion?: string | null;
  color?: string | null; // se dice igual (CAMPOS_IGUALES)
  audio?: string | null; // se dice igual (CAMPOS_IGUALES)
  pacienteNombre?: string | null;
  medicalRecordNumber?: string | null;
  servicioNombre?: string | null;
};

// `porSeccion` NO está en el mapa → queda en español (sus claves internas son claves de sección = datos).
export type PanelContador = { staffId: string; total: number; porSeccion: Record<string, number> };

// GET /paneles/:clave/definicion — UNA llamada: panel + secciones + personal + estatus vivo.
export function getPanelDefinicion(clave: string, centroId?: string): Promise<PanelDefinicion> {
  return apiFetch<PanelDefinicion>(`/panels/${clave}/definition`, {}, centroId);
}

// GET /paneles/:clave/notificaciones — avisos pendientes al abrir la pantalla.
export function getPanelNotificaciones(clave: string, centroId?: string): Promise<PanelNotificacion[]> {
  return apiFetch<unknown>(`/panels/${clave}/notifications`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelNotificacion[]) : (((r as { items?: PanelNotificacion[] })?.items) ?? []),
  );
}

// POST /paneles/:clave/notificar — lo llama la campana. Idempotente (doble toque no duplica).
// El aviso puede nacer de una SESIÓN (frontdesk) o de una CITA (Atención). La misma columna sirve en
// los dos tableros, así que quien llama manda el id que corresponda a su entidad — el BE acepta ambos.
// `seccion` NO está en el mapa → se envía tal cual (el middleware lo deja pasar al DTO `seccion`).
export function notificarPanel(
  clave: string,
  payload: { seccion: string; sessionId?: string; appointmentId?: string },
  centroId?: string,
): Promise<PanelNotificacion> {
  return apiFetch<PanelNotificacion>(
    `/panels/${clave}/notify`,
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
  const env = await apiFetchEnvelope<PanelNotificacion>(`/panels/notifications/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({ staffId: personalId }),
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
    `/panels/notifications/${id}/cancel`,
    { method: "POST", body: JSON.stringify(motivo ? { reason: motivo } : {}) },
    centroId,
  );
}

// GET /paneles/:clave/contadores?fecha=YYYY-MM-DD — contadores del día por persona (NO se llevan en el FE).
export function getPanelContadores(clave: string, fecha: string, centroId?: string): Promise<PanelContador[]> {
  return apiFetch<unknown>(`/panels/${clave}/counters?date=${fecha}`, {}, centroId).then((r) =>
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
  const qs = opts.includeInactive ? "?includeInactive=true" : ""; // `includeInactive` no está en el mapa → igual
  return apiFetch<unknown>(`/panels/${clave}/sections${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as PanelSeccion[]) : (((r as { items?: PanelSeccion[] })?.items) ?? []),
  );
}
export function createPanelSeccion(
  clave: string,
  payload: CreatePanelSeccionPayload,
  centroId?: string,
): Promise<PanelSeccion> {
  return apiFetch<PanelSeccion>(
    `/panels/${clave}/sections`,
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
    `/panels/sections/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
// DELETE /paneles/secciones/:id — 409 si tiene histórico (el mensaje trae el conteo): NO es un fallo
// a ocultar, se muestra y se ofrece desactivar. No arrastra histórico a propósito.
export function deletePanelSeccion(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/panels/sections/${id}`, { method: "DELETE" }, centroId);
}
// PUT /paneles/:clave/secciones/orden — reordenar en BLOQUE (atómico): manda la lista entera. Si
// algún id no es del panel → 400 y no se aplica ninguno.
// El cuerpo `{ ordenes: [{ id, orden }] }` se queda en español: `ordenes` NO está en el mapa y `orden`
// no colisiona con ningún nombre inglés → ambos pasan íntegros por el middleware al DTO (dto.ordenes).
export function reordenarSecciones(
  clave: string,
  ordenes: { id: string; orden: number }[],
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/panels/${clave}/sections/order`,
    { method: "PUT", body: JSON.stringify({ ordenes }) },
    centroId,
  );
}
