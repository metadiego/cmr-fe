import type { components } from "./schema";
import type { ApiWarning } from "./types";
import { apiFetch, apiFetchEnvelope } from "./client";

// Escritura con avisos NO bloqueantes (BE PR #168): la operación se realiza y el BE adjunta
// `meta.warnings` (p. ej. cupo excedido). El FE los muestra como toast traducido por labelKey.
export type ConWarnings<T> = { data: T; warnings: ApiWarning[] };

// Service session (frontdesk). Unlike medical citas, sessions are per-DAY
// (no hora/horaFin) — the service calendar schedules by date only.
export type Sesion = components["schemas"]["FrontdeskSesionEntity"];
export type CreateSesionPayload = components["schemas"]["CreateSesionDto"];
export type EstadoSesion = Sesion["status"];

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// GET /frontdesk/sesiones?desde&hasta&servicioId?&tecnicoId? — flat array (NOT
// paginated) of sessions in the range; for the month calendar.
export async function listSesionesRango(params: {
  desde: string;
  hasta: string;
  servicioId?: string;
  tecnicoId?: string;
  pacienteId?: string; // historial de servicios de un paciente (ficha → Acciones)
  centroId?: string; // fuerza el centro de la lectura vía X-Tenant-ID (selector de centro EN la pantalla)
}): Promise<Sesion[]> {
  const sp = new URLSearchParams({ from: params.desde, to: params.hasta });
  if (params.servicioId) sp.set("serviceId", params.servicioId);
  if (params.tecnicoId) sp.set("technicianId", params.tecnicoId);
  if (params.pacienteId) sp.set("patientId", params.pacienteId);
  return asArray<Sesion>(await apiFetch(`/frontdesk/sesiones?${sp.toString()}`, {}, params.centroId));
}

export function getSesion(id: string): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sesiones/${id}`);
}

// Conteo de PRESENTES por servicio (la burbuja del legado): cuánta gente está ahora en cada terapia.
// Cuenta SOLO el estado `presente` (en_terapia y asistido no cuentan). Trae TODOS los servicios del
// centro con presentes:0 incluido (el FE decide esconder vacíos o no). Permiso frontdesk.read. Se refresca
// por el SSE que la pantalla ya escucha; NO sondear. Handoff presentes-por-servicio.
export interface PresentePorServicio {
  serviceId: string;
  slug: string;
  labelKey: string;
  present: number;
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

// Agenda VARIAS fechas de un servicio para un paciente (una cita por fecha). El BE avisa si excede la
// disponibilidad (no bloquea). Devuelve las sesiones creadas (o un resumen).
export type AgendarMultiplePayload = components["schemas"]["AgendarMultipleDto"];
export async function agendarMultiple(
  payload: AgendarMultiplePayload,
  centroId?: string,
): Promise<ConWarnings<unknown>> {
  const env = await apiFetchEnvelope<unknown>(`/frontdesk/sesiones/agendar-multiple`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { data: env.data, warnings: env.meta.warnings ?? [] };
}

// Reagendar una sesión a otra fecha (fechas flexibles).
export function reagendarSesion(sesionId: string, fecha: string, centroId?: string): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/agenda`,
    { method: "PATCH", body: JSON.stringify({ date: fecha }) },
    centroId,
  );
}

// Calendario del paciente (coloreado por tipo de servicio) para un rango.
export type AgendaItem = {
  date: string;
  status: string;
  servicioNombre: string | null; // NO en el mapa (servicioNombre) — dejado en español
  serviceSlug: string | null;
  color: string | null;
};
export function getAgendaPaciente(
  pacienteId: string,
  desde: string,
  hasta: string,
  centroId?: string,
): Promise<AgendaItem[]> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  return apiFetch<unknown>(`/frontdesk/pacientes/${pacienteId}/agenda?${sp}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as AgendaItem[]) : (((r as { items?: AgendaItem[] })?.items) ?? []),
  );
}

// Vista-día por HORA (cupos) de un servicio: horas con cupo/agendadas/vacíos (BE prod 2026-07-23).
// Cupos configurables por POST/PUT /citas/cupos (precedencia fecha>diaSemana>default, centro>global).
// `cupo`/`agendadas`/`vacios`/`horas` NO están en el mapa — dejados en español.
export type AgendaHora = { time: string; cupo: number; agendadas: number; vacios: number };
export type AgendaDiaHoras = { serviceId?: string; date?: string; horas: AgendaHora[] };
export function getAgendaHoras(
  servicioClave: string,
  fecha: string,
  centroId?: string,
): Promise<AgendaDiaHoras> {
  const sp = new URLSearchParams({ service: servicioClave, date: fecha });
  return apiFetch<AgendaDiaHoras>(`/frontdesk/agenda?${sp}`, {}, centroId);
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

// CAMBIO DE PROTOCOLO: el médico deja sin efecto sesiones pendientes y las reemplaza por otras. Contrato
// verificado por HTTP: POST /facturas/paquetes/cambio-protocolo/:pacienteId con paqueteOrigenIds (ids de
// pendientes-entrega), nuevos (productoId + sesionesTotales≥1, opc. cantidad/areas/dosis), motivo (obl.),
// medicoId opc., reintegros opc. (unidades selladas que vuelven al almacén de un producto de entrega
// directa). Todo-o-nada; devuelve avisos (diferencia de valor, reintegros ignorados…). Handoff
// cambio-de-protocolo. Las cantidades nuevas son juicio del médico: el BE AVISA, no bloquea.
export interface CambioProtocaloNuevo {
  productId: string;
  totalSessions: number;
  quantity?: number;
  areas?: number; // NO en el mapa — dejado en español
  dose?: number;
}
export interface CambioProtocoloPayload {
  paqueteOrigenIds: string[]; // NO en el mapa (plural) — dejado en español
  newOnes: CambioProtocaloNuevo[];
  reason: string;
  doctorId?: string;
  // `reintegros` y `unidadesSelladas` NO en el mapa — dejados en español (productoId sí → productId).
  reintegros?: { productId: string; unidadesSelladas: number }[];
}
export interface CambioProtocoloResult {
  changeId?: string;
  creados?: unknown[]; // NO en el mapa — dejado en español
  cerrados?: unknown[]; // NO en el mapa — dejado en español
  avisos?: { code?: string; labelKey?: string; message?: string }[]; // `avisos` NO en el mapa
}
export function aplicarCambioProtocolo(
  pacienteId: string,
  payload: CambioProtocoloPayload,
  centroId?: string,
): Promise<CambioProtocoloResult> {
  return apiFetch<CambioProtocoloResult>(
    `/facturas/paquetes/cambio-protocolo/${encodeURIComponent(pacienteId)}`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
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
  porTipo: Record<string, number>; // NO en el mapa — dejado en español
  avisos: FrontdeskAviso[]; // `avisos` NO en el mapa — dejado en español
}
export function getAvisosFrontdesk(
  desde: string,
  hasta: string,
  centroId?: string,
): Promise<FrontdeskAvisosReporte> {
  const sp = new URLSearchParams({ from: desde, to: hasta });
  return apiFetch<FrontdeskAvisosReporte>(`/frontdesk/reportes/avisos?${sp.toString()}`, {}, centroId);
}

// Estatus de enfermeras del día (triage/vitales): actuales + catálogo de tipos (color/labelKey) +
// set tipado (PR #141: SetNurseStatusDto — statusTipoId null = reset).
export type NurseStatusTipo = components["schemas"]["NurseStatusTipoEntity"];
export type SetNurseStatusPayload = components["schemas"]["SetNurseStatusDto"];
export type NurseStatusActual = {
  staffId: string;
  personalNombre?: string | null; // NO en el mapa — dejado en español
  statusTypeId: string | null;
  date?: string;
};
export function getNurseStatusTipos(centroId?: string): Promise<NurseStatusTipo[]> {
  return apiFetch<NurseStatusTipo[]>(`/frontdesk/nurse-status/tipos`, {}, centroId);
}
export function getNurseStatusActuales(fecha: string, centroId?: string): Promise<NurseStatusActual[]> {
  return apiFetch<NurseStatusActual[]>(`/frontdesk/nurse-status?date=${fecha}`, {}, centroId);
}
// Historial de terapias del paciente por servicio (PR #148) — alimenta el modal "Historial de terapias".
// Todo proyectado por el BE (X/Y, áreas, staff); el FE solo pinta. Migradas viejas → sesionNumero/staff null.
// `servicioNombre`/`sesionNumero`/`areas`/`staffNombre` NO en el mapa — dejados en español.
export type HistorialSesion = {
  id: string;
  date: string;
  status: string;
  serviceId: string;
  servicioNombre: string | null;
  sesionNumero: number | null;
  totalSessions: number | null;
  areas: number | null;
  staffNombre: string | null;
};
export function getHistorialPaciente(
  pacienteId: string,
  servicioId?: string,
  centroId?: string,
): Promise<HistorialSesion[]> {
  const qs = servicioId ? `?serviceId=${encodeURIComponent(servicioId)}` : "";
  return apiFetch<unknown>(`/frontdesk/pacientes/${pacienteId}/historial${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as HistorialSesion[]) : (((r as { items?: HistorialSesion[] })?.items) ?? []),
  );
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
