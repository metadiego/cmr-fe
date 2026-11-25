import type { components } from "./schema";
import type { ApiWarning } from "./types";
import { apiFetch, apiFetchEnvelope, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";
import { bookableServicesPath } from "@/lib/frontdesk/bookable-services-path";
import { normalizeBookMultipleResult, type BookMultipleResultRaw } from "./book-multiple";

// Escritura con avisos NO bloqueantes (BE PR #168): la operación se realiza y el BE adjunta
// `meta.warnings` (p. ej. cupo excedido). El FE los muestra como toast traducido por labelKey.
export type ConWarnings<T> = { data: T; warnings: ApiWarning[] };

// Ficha MÍNIMA del paciente adjunta a toda respuesta con `patientId` (BE 29-sep): récord + nombre en el
// borde, para no pedirlo fila a fila. Ambos pueden ser null. Handoff el-paciente-viaja-con-su-record.
export type EmbeddedPatient = { id: string; medicalRecordNumber: string | null; name: string | null };

// Service session (frontdesk). Day-based (no hora/horaFin). `patient` viene adjunto (ver EmbeddedPatient),
// opcional en el tipo porque el schema aún no lo declara, pero el API ya lo manda (verificado prod 29-sep).
export type Sesion = components["schemas"]["FrontdeskSesionEntity"] & { patient?: EmbeddedPatient | null; clinicName?: string | null };
// `confirmed` (cmr-be 4a, typed by hand until gen:api runs against 4a): born booked and confirmed; needs
// `appointments.confirm` in the target center. Ignored by the backend for a session born present.
export type CreateSesionPayload = components["schemas"]["CreateSesionDto"] & { confirmed?: boolean };
export type EstadoSesion = Sesion["status"];

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// GET /frontdesk/sesiones?desde&hasta&servicioId?&tecnicoId? — flat array (NOT paginated) of the range.
export async function listSesionesRango(params: {
  desde: string;
  hasta: string;
  servicioId?: string;
  tecnicoId?: string;
  pacienteId?: string; // historial de servicios de un paciente (ficha → Acciones)
  centroId?: CenterChoice; // one center (X-Tenant-ID), several or `null` (every readable one: calendar)
}): Promise<Sesion[]> {
  const sp = new URLSearchParams({ from: params.desde, to: params.hasta });
  if (params.servicioId) sp.set("serviceId", params.servicioId);
  if (params.tecnicoId) sp.set("technicianId", params.tecnicoId);
  if (params.pacienteId) sp.set("patientId", params.pacienteId);
  // A patient's history spans every readable center; a day view is one; the calendar, those shown.
  const path = `/frontdesk/sesiones?${sp.toString()}`;
  return asArray<Sesion>(await apiFetch(params.pacienteId ? path : await oneCenterPath(path, params.centroId), {}, tenantOf(params.centroId)));
}

export function getSesion(id: string): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sesiones/${id}`);
}

// Conteo de PRESENTES por servicio (la burbuja del legado): cuánta gente está ahora en cada terapia.
// Cuenta SOLO el estado `presente` (en_terapia y asistido no cuentan). Trae TODOS los servicios del
// centro con presentes:0 incluido (el FE decide esconder vacíos o no). Permiso frontdesk.read. Se refresca
// por el SSE que la pantalla ya escucha; NO sondear. Handoff presentes-por-servicio.
//
// `citasHoy` (2026-09-25, docs/specs/presentes-por-servicio.md en cmr-be): sesiones del servicio
// para la fecha en cualquier estado salvo `cancelada` — NO "presente ahora mismo". Es el dato
// correcto para decidir si un tab de servicio tiene algo que mostrar hoy; `present` NO sirve para
// eso (verificado en vivo: escondía 18 de 19 servicios de Bayamón porque nadie estaba físicamente
// ahí en ese instante, aunque varios tuvieran agenda para más tarde — handoff
// frontdesk-tabs-mayusculas-y-solo-actividad, revertido y corregido el mismo día).
export interface PresentePorServicio {
  serviceId: string;
  slug: string;
  labelKey: string;
  present: number;
  citasHoy: number;
}
export interface PresentesResumen {
  date: string;
  services: PresentePorServicio[];
  totalPresent: number;
}
export async function getPresentes(centroId?: string): Promise<PresentesResumen | null> {
  // El endpoint aún se está construyendo en el BE: si no existe (404) o falla, la barra simplemente no
  // muestra contadores en vez de romperse. En cuanto viva, empieza a pintar solo.
  try {
    return await apiFetch<PresentesResumen>(`/frontdesk/presentes`, {}, centroId);
  } catch {
    return null;
  }
}

// POST /frontdesk/sesiones — schedule a service session on a date (no time).
// Devuelve la sesión + los `warnings` del BE (cupo excedido / sin cupo) — no bloqueante.
export async function crearSesion(
  payload: CreateSesionPayload,
  centroId?: string,
): Promise<ConWarnings<Sesion>> {
  const env = await apiFetchEnvelope<Sesion>(`/frontdesk/sesiones`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { data: env.data, warnings: env.meta.warnings ?? [] };
}

// ——— AGENDAR (programar citas de servicio) — BE en prod 2026-07-23 ———

// Agenda VARIAS fechas de un servicio (una cita por fecha); el BE avisa si excede disponibilidad (no bloquea).
export type AgendarMultiplePayload = components["schemas"]["AgendarMultipleDto"];
export async function agendarMultiple(
  payload: AgendarMultiplePayload,
  centroId?: string,
): Promise<ConWarnings<unknown> & { advertencias: ApiWarning[] }> {
  const env = await apiFetchEnvelope<unknown>(`/frontdesk/sesiones/agendar-multiple`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { data: env.data, warnings: env.meta.warnings ?? [], advertencias: env.meta.advertencias ?? [] }; // BE #547: avisa, no bloquea
}

// Agenda VARIOS servicios en VARIAS fechas (el cruce completo) para un paciente, en UNA sola llamada
// (POST /frontdesk/sessions/book-multiple), en inglés: `serviceIds` y `dates`. Devuelve `creadas`/`omitidas`
// (idempotente) + avisos de cupo y disponibilidad excedida. Nunca bloquea. Handoff citar-varios-servicios.
export type BookMultipleResult = { creadas: Sesion[]; omitidas: number; aviso: unknown | null };
export async function agendarVariosServicios(
  // Handoff citar-varios-servicios / citar-marcar-los-servicios-con-saldo.
  payload: { patientId: string; serviceIds: string[]; dates: string[]; time?: string; confirmed?: boolean },
  centroId?: string,
): Promise<ConWarnings<BookMultipleResult> & { advertencias: ApiWarning[] }> {
  const env = await apiFetchEnvelope<BookMultipleResultRaw<Sesion>>(`/frontdesk/sessions/book-multiple`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  // `advertencias` (BE #547): BOOKING_DAY_SKIPPED — un día se saltó por una regla que bloquea; el resto sí se agendó.
  return {
    data: normalizeBookMultipleResult(env.data),
    warnings: env.meta.warnings ?? [],
    advertencias: env.meta.advertencias ?? [],
  };
}

// Servicios que el paciente COMPRÓ y aún le quedan pendientes (pending > 0): comprado-y-consumido NO
// aparece. Solo servicios activos del centro activo, ordenados por pendientes (más primero) y por nombre.
// Sirve para pre-marcar las casillas en «Citar». `pending` sale de la misma cuenta que la disponibilidad
// por servicio. GET /frontdesk/patients/:id/availability. Handoff citar-marcar-los-servicios-con-saldo.
export type ServicioConSaldo = { serviceId: string; name: string; slug: string; pending: number };
export function getServiciosConSaldo(patientId: string, centroId?: string): Promise<ServicioConSaldo[]> {
  return apiFetch<ServicioConSaldo[]>(`/frontdesk/patients/${patientId}/availability`, {}, centroId);
}

// Services a patient can still book at the booking center (GET /frontdesk/patients/:id/bookable-services).
// Rows may share one package pool: never sum `bookable` across rows. `sources` splits it by package center.
export interface BookableService {
  serviceId: string;
  bought: number;
  booked: number;
  bookable: number;
  /** `centerName` is null when the BE cannot name the package's center. */
  sources: { centerId: string; centerName: string | null; bookable: number }[];
}
export function getBookableServices(
  patientId: string,
  bookingCenterId: string,
  centerIds: string[],
): Promise<BookableService[]> {
  return apiFetch<BookableService[]>(bookableServicesPath(patientId, centerIds), {}, bookingCenterId);
}

// Pestañas del frontdesk (BE 1-oct). `boardSlug` dice qué tablero la sirve: "servicios" o "atencion" (el
// tablero de Atención que ya existe). /api/v2 en inglés. Handoff consulta-como-pestana-del-frontdesk.
export interface FrontdeskTab {
  slug: string;
  name: string;
  labelKey: string;
  boardSlug: string; // "servicios" | "atencion" ("frontdesk_consultation" after cmr-be #557: compare with isConsultationBoard)
  entity: string; // "sesion" | "cita"
  serviceId: string | null;
  sortOrder: number;
  color: string | null; icon: string | null;
}
export function getFrontdeskTabs(centroId?: string): Promise<FrontdeskTab[]> {
  return apiFetch<FrontdeskTab[]>(`/frontdesk/tabs`, {}, centroId).then((r) => (Array.isArray(r) ? r : []));
}
// Move a session to another day (flexible dates). Without `time` the backend keeps the session's current
// one. Answers the session plus the new day's slot `warnings` (non-blocking, meta.warnings).
export async function reagendarSesion(
  sesionId: string,
  fecha: string,
  centroId?: string,
  time?: string,
): Promise<ConWarnings<Sesion>> {
  const env = await apiFetchEnvelope<Sesion>(
    `/frontdesk/sesiones/${sesionId}/agenda`,
    { method: "PATCH", body: JSON.stringify(time ? { date: fecha, time } : { date: fecha }) },
    centroId,
  );
  return { data: env.data, warnings: env.meta.warnings ?? [] };
}

// Calendario del paciente (coloreado por tipo de servicio) para un rango.
export type AgendaItem = {
  date: string;
  status: string;
  serviceId?: string | null; // (contrato BE handoff frontdesk-filtrar-por-paciente)
  serviceSlug: string | null; // clave estable para cruzar con los servicios del centro
  serviceName: string | null; // antes `servicioNombre`; el BE lo renombró a `serviceName` (2026-09-17)
  color: string | null;
};
export async function getAgendaPaciente(
  pacienteId: string,
  desde: string,
  hasta: string,
  centroId?: string,
): Promise<AgendaItem[]> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  const path = await oneCenterPath(`/frontdesk/pacientes/${pacienteId}/agenda?${sp}`, centroId);
  return apiFetch<unknown>(path, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as AgendaItem[]) : (((r as { items?: AgendaItem[] })?.items) ?? []),
  );
}

// ——— Vista diaria del frontdesk (F4) — ver docs/plans/fe-frontdesk-dia.md ———

// Proyección del día por servicio: columnas efectivas del tablero + filas ya resueltas por el BE
// ({ id, <clave de columna>: valor }). El FE NO recalcula; solo pinta.
export type FrontdeskColumna = {
  clave: string;
  labelKey: string;
  // Nombre propio del negocio para esta columna en este servicio (render.label): tal cual, sin traducir.
  label?: string | null;
  tipo: string;
  binding: string;
  editable: boolean;
  permiso: string | null;
  render: Record<string, unknown> | null;
  orden: number;
  fijo: boolean;
  color: string | null;
};
export type FrontdeskFila = { id: string } & Record<string, unknown>;

// Contador del DÍA que "se activa" al abrir la pestaña del servicio (BE, GET /frontdesk/tablero): suma lo
// que corresponde EXACTAMENTE a las filas devueltas (canceladas no suman). Es derivado: corregir una dosis
// corrige el contador solo. `equivalencia` (opcional) traduce el total a viales/insumo por el `contenido`
// del insumo (p. ej. 90 g → 3,6 viales de 25 g). `cantidad` NO se redondea: el decimal es la información
// (queda vial abierto). Handoff HANDOFF-contador-del-dia-en-el-tablero.
export type FrontdeskTotal = {
  columna: string;
  labelKey: string;
  total: number;
  unidad?: string | null;
  equivalencia?: {
    insumoSku?: string | null;
    cantidad: number;
    unidad?: string | null;
    capacidad?: number | null;
  } | null;
};
// Claves de bolsa opacas del tablero: se traduce la CLAVE (columnas→columns, filas→rows,
// totales→totals); el CONTENIDO de cada columna/fila/total NO se toca (board engine).
export type FrontdeskTablero = { columns: FrontdeskColumna[]; rows: FrontdeskFila[]; totals?: FrontdeskTotal[] };

export function getFrontdeskTablero(
  servicio: string,
  fecha: string,
  centroId?: string,
  // Rango (2 fechas, solo gerente — PR #141): desde/hasta mandan sobre `fecha`.
  rango?: { desde: string; hasta: string },
): Promise<FrontdeskTablero> {
  const sp = new URLSearchParams({ service: servicio, date: fecha });
  if (rango) {
    sp.set("from", rango.desde);
    sp.set("to", rango.hasta);
  }
  return apiFetch<FrontdeskTablero>(`/frontdesk/tablero?${sp.toString()}`, {}, centroId);
}

// Transiciones del flujo (sellan hora en el BE): presente → en-terapia → asistido.
export type TransicionPayload = components["schemas"]["TransicionSesionDto"];
export type TransicionClave = "presente" | "en-terapia" | "asistido";
export function marcarTransicion(
  sesionId: string,
  transicion: TransicionClave,
  payload: TransicionPayload = {},
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/${transicion}`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Confirm / unconfirm a therapy session (cmr-be 4a, permission `appointments.confirm` in the session's
// center). No body; both answer the bare session.
export function confirmSession(sessionId: string, centroId?: string): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sessions/${sessionId}/confirm`, { method: "POST" }, centroId);
}
export function unconfirmSession(sessionId: string, centroId?: string): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sessions/${sessionId}/unconfirm`, { method: "POST" }, centroId);
}

export function cancelarSesion(sesionId: string, motivo: string, centroId?: string): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/cancelar`,
    { method: "POST", body: JSON.stringify({ reason: motivo }) },
    centroId,
  );
}

// Reparación admin (RBAC): corrige estado/cantidad/producto con motivo auditable.
export type RepararSesionPayload = components["schemas"]["RepararSesionDto"];
export function repararSesion(
  sesionId: string,
  payload: RepararSesionPayload,
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/reparar`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Guardar datos de la sesión (columnas medición, PR #136): merge sobre sesion.datos; el BE valida rango.
export function guardarDatosSesion(
  sesionId: string,
  datos: Record<string, unknown>,
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/acciones`,
    { method: "POST", body: JSON.stringify({ data: datos }) },
    centroId,
  );
}

// Disponibilidad del paciente para el GRUPO del servicio (PR #134 + enriquecido en PR #172).
// El BE ahora devuelve el total FIEL (láser: cantidad × áreas × días), el desglose de
// `multiplicadores` (claves dinámicas del grupo — NO asumir), el `sku` estable y el grupo.
// Los campos viejos (total/entregadas/pendientes) se conservan como alias durante la transición.
export type PaqueteDisponibilidad = {
  id?: string; // id del paquete_sesiones (para PATCH …/paquetes/:id/ajuste)
  invoiceItemId?: string;
  sku?: string | null; // código ESTABLE del producto (ubicar/agrupar; no el nombre)
  productoNombre?: string | null; // NO en el mapa — dejado en español
  groupKey?: string | null;
  billingGroupId?: string | null;
  // Totales fieles (nuevos) + alias viejos.
  totalSessions?: number;
  deliveredSessions?: number;
  pendiente?: number; // NO en el mapa — dejado en español
  total?: number; // alias viejo de totalSessions (total es igual)
  entregadas?: number; // NO en el mapa — dejado en español (alias viejo)
  pendientes?: number; // NO en el mapa — dejado en español (alias viejo)
  // Desglose multiplicador del grupo, p.ej. { dias: 12, areas: 1 }. Claves dinámicas.
  multiplicadores?: Record<string, number> | null; // NO en el mapa — dejado en español
};
export type DisponibilidadServicio = {
  paquetes: PaqueteDisponibilidad[]; // `paquetes`/`pendienteTotal` NO en el mapa — dejados en español
  pendienteTotal: number;
};

// Normaliza un paquete a los campos fieles (tolera el payload viejo y el nuevo).
export function paqueteTotales(p: PaqueteDisponibilidad): {
  totales: number;
  entregadas: number;
  pendiente: number;
} {
  const totales = Number(p.totalSessions ?? p.total ?? 0);
  const entregadas = Number(p.deliveredSessions ?? p.entregadas ?? 0);
  const pendiente = Number(p.pendiente ?? p.pendientes ?? Math.max(0, totales - entregadas));
  return { totales, entregadas, pendiente };
}

// PATCH /facturas/paquetes/:id/ajuste — corrige la disponibilidad si facturación se equivocó.
// Manda `sesionesTotales` explícito o `multiplicadores` (el BE recalcula N = cantidad × Π).
// RBAC: `frontdesk.disponibilidad.editar`. El BE valida no bajar de lo ya consumido (400).
export type AjustarDisponibilidadPayload = {
  totalSessions?: number;
  multiplicadores?: Record<string, number>; // NO en el mapa — dejado en español
  actorId?: string;
};
export function ajustarDisponibilidad(
  paqueteId: string,
  payload: AjustarDisponibilidadPayload,
  centroId?: string,
): Promise<PaqueteDisponibilidad> {
  return apiFetch<PaqueteDisponibilidad>(
    `/facturas/paquetes/${encodeURIComponent(paqueteId)}/ajuste`,
    { method: "PATCH", body: JSON.stringify(payload) },
    centroId,
  );
}
// POST /facturas/paquetes/:id/transferir — mueve las sesiones PENDIENTES de un paquete a OTRO centro
// (total o parcial), para que el paciente continúe su terapia en la otra oficina. `modo`: "virtual" mueve
// solo el tratamiento (el destino descuenta su propio stock al aplicar) o "fisica" mueve además el
// material entre almacenes (viales/insumos). Reversible con /transferencias/:id/anular. El centro ORIGEN
// es el activo (X-Tenant-ID). Handoff transferir-tratamiento-entre-centros.
export type TransferirTratamientoPayload = {
  destinationClinicId: string;
  sessions?: number; // omitido = todas las pendientes
  mode?: "virtual" | "fisica";
  sourceWarehouseId?: string; // solo modo fisica
  destinationWarehouseId?: string; // solo modo fisica
  reason?: string;
};
export function transferirTratamiento(
  paqueteId: string,
  payload: TransferirTratamientoPayload,
  centroId?: string,
): Promise<unknown> {
  return apiFetch<unknown>(
    `/facturas/paquetes/${encodeURIComponent(paqueteId)}/transferir`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
export function getDisponibilidadServicio(
  servicioId: string,
  pacienteId: string,
  centroId?: string,
): Promise<DisponibilidadServicio> {
  return apiFetch<DisponibilidadServicio>(
    `/frontdesk/servicios/${servicioId}/disponibilidad?patientId=${encodeURIComponent(pacienteId)}`,
    {},
    centroId,
  );
}

// Saldo de entrega del PACIENTE por producto/dosis (GET /facturas/pendientes-entrega?pacienteId).
// Cada sobre comprado (aún con sesiones pendientes) del paciente, en TODOS sus grupos. Alimenta el
// select de DOSIS del frontdesk: cruzando `productoId` con el `value` de las opciones (mismo id) se
// muestra cuánto le queda de cada dosis que compró. Contrato: HANDOFF-dosis-con-saldo-del-paciente /
// cmr-be/docs/specs/frontdesk-consumo-por-dosis.md. NO sumar entre sobres: cada dosis es su propio sobre.
export type PendienteEntrega = {
  id: string; // id del PAQUETE (paquete_sesiones) → es el `paqueteOrigenIds` del cambio de protocolo
  productId: string;
  productoNombre?: string | null; // NO en el mapa — dejado en español
  sku?: string | null;
  pendiente?: number | null; // NO en el mapa — dejado en español (sesiones que le quedan; 0 → agotada)
  totalSessions?: number | null;
  deliveredSessions?: number | null;
  groupKey?: string | null;
  multiplicadores?: Record<string, number> | null; // NO en el mapa — dejado en español
  /** Laser areas each session covers (cmr-be #689); null when unknown or not an area product. */
  areasPerSession?: number | null;
  /** The invoice this package came from; null for a legacy package with no invoice row. */
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  /** Legacy-import reference, shown when there is no invoiceNumber (handoff-transferir-tratamiento-completo). */
  legacyReference?: string | null;
};
export function getPendientesEntrega(pacienteId: string, centroId?: string): Promise<PendienteEntrega[]> {
  return apiFetch<unknown>(
    `/facturas/pendientes-entrega?patientId=${encodeURIComponent(pacienteId)}`,
    {},
    centroId,
  ).then((r) =>
    Array.isArray(r) ? (r as PendienteEntrega[]) : (((r as { items?: PendienteEntrega[] })?.items) ?? []),
  );
}

// AVISOS / DESCUIDOS del día (GET /frontdesk/reportes/avisos?desde&hasta). El BE ya no pierde el
// descuido en silencio: registra tres tipos y este reporte los devuelve con paciente, servicio y quién
// lo hizo. `porTipo` trae SIEMPRE los tres contadores (0 en un día limpio → "todo bien" de un vistazo,
// no se confunde con "no cargó"). Filtra por centro (X-Tenant-ID). RBAC frontdesk.read. Handoff
// aviso-centrado-dosis-no-comprada-y-lista-de-descuidos / cmr-be/docs/specs/avisos-del-descuido-frontdesk.
//  - entrega_sin_paquete: la visita ocurrió sin paquete al que descontar (el insumo no se movió).
//  - dosis_no_comprada:   se aplicó una presentación que el paciente no compró (se cobró al paquete de la fila).
//  - entrega_sin_saldo:   se entregó sin disponibilidad y el pendiente quedó en negativo.
export type FrontdeskAvisoTipo = "entrega_sin_paquete" | "dosis_no_comprada" | "entrega_sin_saldo";
export interface FrontdeskAviso {
  id: string;
  type: string;
  sessionId?: string | null;
  date?: string | null;
  patient?: string | null;
  service?: string | null;
  actorId?: string | null;
  actor?: string | null; // NO en el mapa — dejado en español
  cuando?: string | null; // NO en el mapa — dejado en español
  detalle?: Record<string, unknown> | null; // NO en el mapa — dejado en español (bolsa opaca)
}
export interface FrontdeskAvisosReporte {
  from?: string;
  to?: string;
  total: number;
  byType: Record<string, number>; // se traduce al inglés en /api/v2 (verificado live 1-oct; sus claves de tipo son datos)
  avisos: FrontdeskAviso[]; // `avisos` NO en el mapa — dejado en español
}
export async function getAvisosFrontdesk(
  desde: string,
  hasta: string,
  centroId?: string,
): Promise<FrontdeskAvisosReporte> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  const path = await oneCenterPath(`/frontdesk/reportes/avisos?${sp.toString()}`, centroId);
  return apiFetch<FrontdeskAvisosReporte>(path, {}, centroId);
}

// Estatus de personal del día (triage/vitales/descanso): actuales + catálogo + set (PR #141, statusTipoId null = reset).
export type NurseStatusTipo = components["schemas"]["NurseStatusTipoEntity"];
export type SetNurseStatusPayload = components["schemas"]["SetNurseStatusDto"] & { durationMinutes?: number }; // caducidad, BE PR #498 — a mano hasta gen:api
export type NurseStatusActual = {
  staffId: string;
  personalNombre?: string | null; // NO en el mapa — dejado en español
  statusTypeId: string | null;
  date?: string;
  expiresAt?: string | null; // caducidad (BE PR #498); vencido = ya no viene en la lectura
};
export function getNurseStatusTipos(centroId?: string): Promise<NurseStatusTipo[]> {
  return apiFetch<NurseStatusTipo[]>(`/frontdesk/nurse-status/tipos`, {}, centroId);
}

// The controller takes an inline body, not a class-validator DTO (confirmed by a peer session,
// 25-nov-2026): the generated schema shows these two as requestBody: never, and nothing server-side
// validates `color`/`icon` — enforce shape client-side instead. `slug`/`labelKey` are NOT
// server-generated (unlike this catalog's sibling, priority-flag-types): send both on create, and
// `slug` is fixed afterward (its own unique index — a duplicate is a raw DB error, not a clean
// VALIDATION_ERROR). The server always creates with `active: true`; there is no DELETE — a type
// already referenced by history retires via `active: false` on the update call instead.
export type CreateNurseStatusTipoPayload = {
  slug: string;
  labelKey: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
  countsAsAvailable?: boolean;
  durationOptions?: number[] | null;
};
export type UpdateNurseStatusTipoPayload = Partial<
  Pick<NurseStatusTipo, "labelKey" | "name" | "color" | "icon" | "sortOrder" | "active" | "countsAsAvailable" | "durationOptions">
>;
export function createNurseStatusTipo(payload: CreateNurseStatusTipoPayload, centroId?: string): Promise<NurseStatusTipo> {
  return apiFetch<NurseStatusTipo>(`/frontdesk/nurse-status/tipos`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updateNurseStatusTipo(id: string, payload: UpdateNurseStatusTipoPayload, centroId?: string): Promise<NurseStatusTipo> {
  return apiFetch<NurseStatusTipo>(`/frontdesk/nurse-status/tipos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }, centroId);
}
export function getNurseStatusActuales(fecha: string, centroId?: string): Promise<NurseStatusActual[]> {
  return apiFetch<NurseStatusActual[]>(`/frontdesk/nurse-status?date=${fecha}`, {}, centroId);
}
// Carrito de compras de la fila (columna fd_compras). Una línea de compra (paquete de sesiones facturado);
// `entregadas`/`pendientes` = cuánto le queda al paciente (clave en frontdesk). Contrato:
// HANDOFF-columna-carrito-compras / cmr-be/docs/specs/frontdesk-columna-compras.md.
// `entregadas`/`pendientes` NO en el mapa — dejados en español.
export type CompraLinea = {
  id?: string;
  date?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  sku?: string | null;
  product?: string | null;
  quantity?: number | null;
  sessions?: number | null;
  entregadas?: number | null;
  pendientes?: number | null;
  total?: number | null;
};
export type ComprasPaciente = {
  // Compras EMITIDAS el día del tablero (no "hoy"): número que muestra la celda + su desglose.
  // `delDia` NO en el mapa — clave dejada en español (`items` ya es estándar/inglés).
  delDia?: { date?: string | null; sessions?: number | null; items?: CompraLinea[] } | null;
  // Historial completo (cualquier fecha), de la más reciente a la más antigua.
  historial?: CompraLinea[]; // `historial` NO en el mapa — dejado en español
  totals?: {
    // `compras`/`sesionesCompradas`/`sesionesPendientes` NO en el mapa — dejados en español.
    compras?: number | null;
    sesionesCompradas?: number | null;
    deliveredSessions?: number | null;
    sesionesPendientes?: number | null;
  } | null;
};
// GET /frontdesk/pacientes/{id}/compras?servicioId&fecha — servicioId acota al grupo del servicio de la
// fila (pásalo siempre); fecha = la del tablero (acota el bloque "del día").
export function getComprasPaciente(
  pacienteId: string,
  servicioId?: string,
  fecha?: string,
  centroId?: string,
): Promise<ComprasPaciente> {
  const sp = new URLSearchParams();
  if (servicioId) sp.set("serviceId", servicioId);
  if (fecha) sp.set("date", fecha);
  const qs = sp.toString() ? `?${sp.toString()}` : "";
  return apiFetch<ComprasPaciente>(`/frontdesk/pacientes/${pacienteId}/compras${qs}`, {}, centroId);
}

export function setNurseStatus(payload: SetNurseStatusPayload, centroId?: string): Promise<unknown> {
  return apiFetch(
    `/frontdesk/nurse-status`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
