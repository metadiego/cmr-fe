import type { components } from "./schema";
import { apiFetch, oneCenterPath } from "./client";
import type { CuadreReconciliacion } from "@/lib/caja/totales";

export type { CuadreReconciliacion };
import type { ProductSales } from "@/lib/caja/product-sales";
import type { CashSignature, SignOffRole } from "@/lib/caja/sign-off";

// Caja / Cuadre (BE módulo `caja`, v2 `cash`). Tenant-scoped: el X-Tenant-ID lo adjunta client.ts desde el
// centro activo. TODO el I/O de caja pasa por aquí (API-First). Los tipos de catálogo/DTO salen del
// schema OpenAPI; las respuestas que el BE deja sin tipar en Swagger (Record<string,never>) se tipan
// a mano AQUÍ, calcadas del código real del BE (caja.service.ts / caja-reportes.service.ts /
// facturas-reportes.service.ts) — no se asume nada. See docs/specs/2026-07-20-cuadre-caja-design.md.

export type Denominacion = components["schemas"]["DenominacionEntity"];
export type GrupoMetodoPago = components["schemas"]["GrupoMetodoPagoEntity"];
export type CuadreCaja = components["schemas"]["CuadreCajaEntity"];
export type AbrirCuadrePayload = components["schemas"]["AbrirCuadreDto"];
export type ConteoLinea = components["schemas"]["ConteoLineaDto"];
export type CajaDivision = "consulta" | "general";
export type Cajero = components["schemas"]["CajeroDto"];

// Línea de conteo persistida (getById devuelve CuadreCajaEntity + conteo[]). El BE no la tipa en
// Swagger; se refleja la entidad `cuadre_conteo`. La clave `conteo` (contenedor) NO está en el mapa
// api-ingles → el BE la deja en español (el CONTENIDO de cada línea sí se traduce).
export interface CuadreConteo {
  id: string;
  reconciliationId: string;
  denominationId: string;
  quantity: number;
}

// Cuadre con su conteo (respuesta de getById/contar/cerrar). `totalsByMethod` es el snapshot
// (clave de forma de pago → monto neto) que el BE sella al cerrar (bolsa OPACA: sus claves son datos).
export type CuadreConItems = Omit<CuadreCaja, "totalsByMethod"> & {
  totalsByMethod: Record<string, number> | null;
  conteo: CuadreConteo[];
};

// Fila de método de pago (tarjetas / otros) del detalle. slug estable + nombre del catálogo.
export interface DetalleMetodoRow {
  slug: string;
  name: string;
  quantity: number;
  amount: number; // net of the day's refunds (unchanged)
  // BE #560: what was charged and what was refunded through this method (refunds positive).
  sales?: number;
  refunds?: number;
}

// Reporte del día (caja-reportes.service.ts → reporteDia). Fuente principal de la pantalla.
// Muchas claves de este árbol NO están en el mapa api-ingles → el BE las deja en español (contenido
// traducido por recursión): anulaciones, porMetodo, porGrupo, porCajero, detalle, pendientes, documentos,
// devolucionesDetalle, conteoEfectivo, tributario, bruto, devuelto, neto, porEstado, porMedio, tarjetas,
// otros, total*, fondoInicial, cajeros, exonerado, facturasExoneradas, base, formaPago, pendiente.
export interface ReporteDia {
  date: string;
  division: CajaDivision | null;
  userId: string | null;
  sales: {
    from: string;
    to: string;
    invoices: number;
    bruto: number;
    devuelto: number;
    neto: number;
    byStatus: Record<string, number>; // `porEstado`→`byStatus` en /api/v2 (verificado live 1-oct)
    byPaymentMethod: Record<string, number>; // `porMedio`→`byPaymentMethod` (verificado live 1-oct)
  };
  refunds: { quantity: number; total: number };
  anulaciones: { quantity: number; total: number };
  byMethod: Record<string, number>; // `porMetodo`→`byMethod` en /api/v2 (verificado live 1-oct)
  porGrupo: Record<string, number>;
  // QUIÉN facturó (BE 2026-08-20): SIEMPRE presente (antes solo con `division`). Sin división = todos
  // los facturadores de las dos divisiones; con división = los de esa; con userId = solo ese. Un
  // cajero que no es gerencia recibe una sola fila (la suya), lo fija el BE. La Σ de `porCajero` debe
  // dar `detalle.total` (hay prueba del BE); si en pantalla no cuadra, es defecto, no se maquilla.
  // Handoff cuadre-quien-facturo-por-cajero. Nombre resuelto por el BE.
  // OJO: este contenedor NO se englishifica (verificado live 1-oct): el BE devuelve `usuarioId` y `nombre`
  // en español. El tipo decía `userId`/`name` y por eso los nombres de cajero salían en blanco. Son DATOS
  // del contenedor, no se traducen. Handoff cuadre-quien-facturo-por-cajero.
  porCajero?: Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
  detalle: {
    efectivo: { quantity: number; amount: number; sales?: number; refunds?: number };
    tarjetas: DetalleMetodoRow[];
    otros: DetalleMetodoRow[];
    totalTarjetas: number;
    totalOtros: number;
    totalElectronicas: number;
    total: number;
    // BE #560: cards WITHOUT refunds (to match the settlements) and the refunds per method.
    cardSalesTotal?: number;
    refundsByMethod?: Array<{ slug: string; name: string; amount: number }>;
  };
  pendientes: Array<{
    id: string;
    number: string | null;
    date: string | null;
    patientId: string;
    total: number;
    paidAmount: number;
    pendiente: number;
  }>;
  // ---- Pie del cuadre (BE 2026-08-06): lo que se entrega a contabilidad. ----
  // Documentos del día: una línea por factura. `formaPago` viene YA resuelta en siglas (p.ej. "EF+VISA")
  // — pintar tal cual, no calcular. `medicalRecordNumber` puede venir null (paciente sin número → celda vacía).
  documentos?: Array<{
    id: string;
    number: string | null;
    patientId?: string | null;
    patient: string | null;
    medicalRecordNumber: string | null;
    formaPago: string | null;
    total: number;
    status: string;
    // Quién facturó ese documento (cmr-be PR #275): sale del cajero de los pagos del día (misma fuente
    // que `porCajero`, cuadra la suma). `user:null` = sin a quién atribuir; `name:null` = sello de
    // integración (llave). En ambos casos se pinta "—", NUNCA el id. Handoff documentos-del-dia-quien-facturo.
    user?: { id: string; name: string | null } | null;
    // Solo presente en el cuadre TOTAL del día (handoff cuadre-unico-del-dia): de qué división es ese
    // documento, para marcarlo en la tabla combinada. Ausente (undefined) en el reporte por división.
    division?: CajaDivision;
  }>;
  // Devoluciones del día con su detalle (bloque aparte, en rojo). `number` = nº de nota de crédito.
  devolucionesDetalle?: Array<{
    id: string;
    number: number | string | null;
    invoiceId: string | null;
    refundedAmount: number;
    reason: string | null;
    // BE #560: what accounting needs to reconcile each refund.
    displayNumber?: string | null;
    invoiceNumber?: string | null;
    patient?: string | null;
    medicalRecordNumber?: string | null;
    refundMethod?: string | null;
    refundMethodSlug?: string | null;
    // BE PR #578: una entrada por cada reembolso ACTIVO, cualquier cantidad (reembolso dividido en
    // varias formas) — `refundMethod` queda de respaldo (texto ya unido, p. ej. "Visa + Cheque") para
    // cuando el BE no lo manda. Siempre que venga no vacío, se pinta ESTE, no el texto unido.
    refundMethods?: Array<{ method: string; slug?: string | null; amount: number }> | null;
    refundedTax?: number | null;
    date?: string | null;
  }>;
  // Reconciliación lista para pintar (BE PR #389, `cuadre`→`reconciliation` en /api/v2): reemplaza
  // calcular "Diferencia (cuadra)" a mano en el FE. `contado:false` = nadie ha guardado un conteo
  // real todavía — NUNCA pintar el verde de "cuadra" en ese caso (handoff
  // cuadre-efectivo-sin-conteo-descuadra-handoff-fe.md). Ver lib/caja/totales.ts (estadoCuadreVivo).
  reconciliation?: CuadreReconciliacion | null;
  // Conteo de efectivo SELLADO del día (hoja del legado): denominaciones de mayor a menor + total.
  // `reconciliationId`/`userId` null = SUMA de las cajas del día (consolidado). `null` = aún sin contar (o
  // el admin ve varios centros a la vez, donde sumar cajas no significa nada) → "sin conteo todavía".
  conteoEfectivo?: {
    reconciliationId: string | null;
    userId: string | null;
    status?: string;
    fondoInicial: number;
    total: number;
    cajeros: number;
    lines: Array<{ denominationId?: string; value: number; quantity: number; amount: number }>;
  } | null;
  // Bloque tributario (lo mira contabilidad). Tres partidas con las mismas columnas + las facturas
  // EXONERADAS (producto gravable al que se le quitó el IVU — decisión que hay que ver). NO recalcular
  // en el cliente: los números salen calzados del BE. Handoff HANDOFF-pie-del-cuadre.
  // «Venta de productos (IVU)» (BE PR #470): product-only taxable/exempt/exonerated, IVU by component,
  // refunds, every product invoice and the check against the day net. `null` = the BE could not compute it.
  productSales?: ProductSales | null;
  tributario?: {
    taxable: TributarioPartida;
    exempt: TributarioPartida;
    exonerado: TributarioPartida;
    facturasExoneradas: string[]; // ids de factura → se cruzan con `documentos` para el nº
  };
  // Modo de conteo del centro (BE #566, handoff .personal/handoff-cuadre-uno-o-dos-conteos.md).
  // `countRequired:false` (centro `single`) = el conteo de ESTA división es respaldo, no obligatorio:
  // el cajero no debe ver parpadear "sin contar" por no haberlo hecho. Ausente = BE viejo → como hoy.
  countMode?: { mode: CashCountMode; countRequired: boolean };
}

// Modo de conteo de efectivo del centro (BE #566). `flexible` = hoy, sin cambios; `split` = dos
// conteos (consulta + general) siempre sumados; `single` = un solo conteo de toda la caja.
export type CashCountMode = "flexible" | "split" | "single";
// OJO: claves en inglés ("consultation"/"general"), DISTINTAS de `CajaDivision` ("consulta"/"general")
// que ya usa `?division=` en el resto de este archivo — no son el mismo campo, no se confunden.
export type CountDivisionKey = "consultation" | "general";
export interface CashCountModeWarning {
  code: string;
  labelKey: string;
  division?: CountDivisionKey;
}
export interface CashCountModeStatus {
  mode: CashCountMode;
  complete: boolean;
  warnings: CashCountModeWarning[];
}
export interface DivisionCountLine {
  denominationId: string;
  value: number;
  quantity: number;
  amount: number;
}
export interface DivisionCount {
  hasCount: boolean;
  counted: number;
  fund: number;
  expected: number;
  difference: number;
  lines: DivisionCountLine[];
}
export interface DivisionCounts {
  consultation: DivisionCount;
  general: DivisionCount;
}
// Una partida tributaria: monto facturado, descuento, base imponible, impuesto y nº de líneas.
export interface TributarioPartida {
  gross?: number; // BE #560: before the discount (invoice-wide discount spread onto lines included)
  amount: number; // base + tax
  discount: number;
  base: number;
  tax: number;
  lines: number;
}

// ---- catálogos (CC1) ------------------------------------------------
export function getDenominaciones(monedaId?: string): Promise<Denominacion[]> {
  const q = monedaId ? `?currencyId=${encodeURIComponent(monedaId)}` : "";
  return apiFetch<Denominacion[]>(`/cash/denominations${q}`);
}

export function getGruposMetodoPago(): Promise<GrupoMetodoPago[]> {
  return apiFetch<GrupoMetodoPago[]>(`/cash/groups`);
}

// Roster de cajeros del centro (auth user id + nombre). El BE aplica el alcance por rol: gerencia
// ve todos; un cajero solo a sí mismo. Puebla el selector con nombres reales (no UUID).
// `fecha`+`division` (BE PR #439): acota a quien cobró esa división ese día o tiene cuadre — sin
// `fecha` sigue siendo el roster completo (compatible con los demás usos de este mismo endpoint).
export function getCajeros(
  q?: string,
  fecha?: string,
  division?: CajaDivision,
): Promise<Cajero[]> {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (fecha) sp.set("date", fecha);
  if (division) sp.set("division", division);
  const qs = sp.toString();
  return apiFetch<Cajero[]>(`/cash/cashiers${qs ? `?${qs}` : ""}`);
}

// ---- reporte del día (CC3) ------------------------------------------
// `division` separa consulta/general; OMITIRLA = totalizado de las DOS divisiones (la vista del
// gerente). `userId` acota a un cajero (undefined = alcance por rol que resuelve el BE). Un cajero
// solo verá el suyo; gerencia puede pasar otro id o null (consolidado).
export function getReporteDia(
  fecha: string,
  division?: CajaDivision | null,
  usuarioId?: string | null,
): Promise<ReporteDia> {
  const sp = new URLSearchParams({ date: fecha });
  if (division) sp.set("division", division);
  if (usuarioId != null) sp.set("userId", usuarioId);
  return apiFetch<ReporteDia>(`/cash/reports/day?${sp.toString()}`);
}

// ---- cuadre (CC2) ---------------------------------------------------
// Lista cuadres para seleccionar/ver anteriores (alcance por rol lo aplica el BE).
export async function listarCuadres(filtros: {
  fecha?: string;
  division?: CajaDivision;
  usuarioId?: string;
  estado?: "abierto" | "cerrado";
}): Promise<CuadreCaja[]> {
  const sp = new URLSearchParams();
  if (filtros.fecha) sp.set("date", filtros.fecha);
  if (filtros.division) sp.set("division", filtros.division);
  if (filtros.usuarioId) sp.set("userId", filtros.usuarioId);
  if (filtros.estado) sp.set("status", filtros.estado);
  const qs = sp.toString();
  // The cash screen is one center's day: the active center's reconciliations.
  return apiFetch<CuadreCaja[]>(await oneCenterPath(`/cash/reconciliations${qs ? `?${qs}` : ""}`));
}

// Abre o RETOMA (idempotente en el BE) el cuadre de esa (división × cajero)/día. `division`
// obligatoria. `userId`: omitido = propio cajero; null = consolidado (gerencia).
export function abrirCuadre(payload: AbrirCuadrePayload): Promise<CuadreCaja> {
  return apiFetch<CuadreCaja>(`/cash/reconciliations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCuadre(id: string): Promise<CuadreConItems> {
  return apiFetch<CuadreConItems>(`/cash/reconciliations/${id}`);
}

export function contarCuadre(
  id: string,
  conteos: ConteoLinea[],
): Promise<CuadreConItems> {
  // La clave `conteos` NO está en el mapa api-ingles → se envía tal cual (el DTO la espera en español).
  return apiFetch<CuadreConItems>(`/cash/reconciliations/${id}/count`, {
    method: "POST",
    body: JSON.stringify({ conteos }),
  });
}

export function cerrarCuadre(id: string): Promise<CuadreConItems> {
  return apiFetch<CuadreConItems>(`/cash/reconciliations/${id}/close`, {
    method: "POST",
  });
}

// Envía el cuadre por email (archivar/compartir). Requiere email destino.
// The sheet by email FOR REAL (BE #478): HTML body + PDF attachment. `emails` empty = the center's
// default list (preference caja.emailRecipients). Answers ONLY when the SMTP server accepted it; 503
// MAIL_NOT_CONFIGURED / 502 MAIL_NOT_SENT / 400 no recipients come back as ApiError.
// `attachmentsIncluded`/`attachmentsSkipped` (BE PR #594-595): el correo manda los settlements
// escaneados del cuadre (o, en el cuadre TOTAL del día, los de TODOS los cuadres de ese día) como
// adjuntos aparte — tope 15MB, lo que no cupo o no se pudo leer queda afuera y se cuenta aquí.
export type CashEmailSent = {
  sent: boolean;
  to: string[];
  messageId: string | null;
  notificationId: string;
  attachmentsIncluded?: number;
  attachmentsSkipped?: number;
};

function centerQs(centerId?: string | null): string {
  return centerId ? `?centerIds=${encodeURIComponent(centerId)}` : "";
}

export function enviarCuadreEmail(id: string, emails: string[], centerId?: string | null): Promise<CashEmailSent> {
  return apiFetch<CashEmailSent>(`/cash/reconciliations/${id}/email${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(emails.length ? { emails } : {}),
  });
}

// The day TOTAL sheet by email (supervisor). One center: `centerIds`, else the session's.
export function enviarCuadreTotalEmail(fecha: string, emails: string[], centerId?: string | null): Promise<CashEmailSent> {
  return apiFetch<CashEmailSent>(`/cash/total-reconciliation/email${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(emails.length ? { date: fecha, emails } : { date: fecha }),
  });
}

// ---- Sign-off («Acepto», BE #486, handoff docs/specs/cash-sign-off-handoff.md) ----------------
// Signing = accepting the sheet as it is now; the sheet need NOT be closed. `cashier` = only the
// sheet's own cashier; `supervisor` = caja.ver_todos, any sheet (cashier, consolidated, day total).
// 409 CASH_SHEET_ALREADY_SIGNED = someone else signed in that role (body: signedBy + signedAt).
export function signCashSheet(id: string, signAs: SignOffRole, centerId?: string | null): Promise<CashSignature> {
  return apiFetch<CashSignature>(`/cash/reconciliations/${id}/sign${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify({ signAs, agree: true }),
  });
}

// Every signature of the sheet, voided ones included (history), oldest first.
// BE #565: a manager acknowledges a correction of already-signed figures (caja.sign_as_manager; 428 shield
// cash.signature.acknowledge; 409 CASH_FIGURES_NOT_CHANGED when the sheet did not move). Reason 3–500.
export function acknowledgeCashSignature(id: string, signatureId: string, reason: string, centerId?: string | null): Promise<CashSignature> {
  return apiFetch<CashSignature>(`/cash/reconciliations/${id}/signatures/${signatureId}/acknowledge${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getCashSignatures(id: string, centerId?: string | null): Promise<CashSignature[]> {
  return apiFetch<CashSignature[]>(`/cash/reconciliations/${id}/signatures${centerQs(centerId)}`);
}

// ---- Adjuntos del cuadre (settlements escaneado, BE PR #516, handoff
// .personal/handoff-cuadre-adjuntar-settlements.md) — sub-recurso aparte del cuadre, igual que las
// firmas: no toca procesarCierre() ni CuadreCaja. El gerente subiendo por un cajero que no sabe usar
// el teléfono es el camino NORMAL, no una excepción (uploadedBy/uploadedByName = quien subió DE VERDAD).
export const CASH_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type CashAttachmentContentType = (typeof CASH_ATTACHMENT_TYPES)[number];
export const CASH_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // tope del bucket (BE)

export interface CashReconciliationAttachment {
  id: string;
  clinicId: string;
  reconciliationId: string;
  uploadedBy: string | null;
  storagePath: string;
  contentType: string;
  ocrStatus: string | null;
  ocrData: unknown;
  createdAt: string;
  updatedAt: string;
}

// La lista trae además `url` (firmada, caduca en 1h — pedir la lista de nuevo para refrescar; puede
// venir null si el archivo no se pudo firmar: pintar "archivo no disponible", sin romper la lista) y
// `uploadedByName` (o null: pintar "—", nunca el id crudo).
export type CashReconciliationAttachmentListed = CashReconciliationAttachment & {
  url: string | null;
  uploadedByName: string | null;
};

export function getCashAttachmentUploadUrl(
  id: string,
  contentType: CashAttachmentContentType,
  centerId?: string | null,
): Promise<{ uploadUrl: string; path: string }> {
  return apiFetch<{ uploadUrl: string; path: string }>(`/cash/reconciliations/${id}/attachments/upload-url${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

// PUT directo al storage firmado (sin apiFetch: el token va en la URL). Mismo patrón que
// lib/api/media.ts, pero sin publicUrl — el bucket es privado.
export async function uploadCashAttachmentFile(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export function registerCashAttachment(
  id: string,
  payload: { path: string; contentType: CashAttachmentContentType },
  centerId?: string | null,
): Promise<CashReconciliationAttachment> {
  return apiFetch<CashReconciliationAttachment>(`/cash/reconciliations/${id}/attachments${centerQs(centerId)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// El más nuevo primero (es historial: nunca se borra ni se reemplaza un adjunto viejo).
export function listCashAttachments(id: string, centerId?: string | null): Promise<CashReconciliationAttachmentListed[]> {
  return apiFetch<CashReconciliationAttachmentListed[]>(`/cash/reconciliations/${id}/attachments${centerQs(centerId)}`);
}

// Eliminar un adjunto (BE PR #588, handoff docs/specs/eliminar-adjunto-cuadre-handoff-be.md). Permiso
// `cash_attachment.delete` (dominio propio, NO `caja.ver_todos`: lo corrigió el BE al cerrar el
// handoff — admin lo tiene por `*`, billing no). 428 `cash.attachment.delete` lo maneja apiFetch solo.
// `motivo` obligatorio (3–500).
export function deleteCashAttachment(id: string, attachmentId: string, motivo: string, centerId?: string | null): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/cash/reconciliations/${id}/attachments/${attachmentId}${centerQs(centerId)}`, {
    method: "DELETE",
    body: JSON.stringify({ motivo }),
  });
}

// ---- Cuadre TOTAL del día (handoff cuadre-unico-del-dia, cmr-be #457, en prod desde 04-nov-2026) --
// Las DOS divisiones + todos los cajeros, un solo conteo opcional, comprobado contra la suma de los
// cuadres individuales. Rutas confirmadas leyendo /api/docs-json de prod (no están en schema.d.ts: el
// BE no les da un DTO de respuesta en Swagger — mismo caso que ReporteDia, tipado a mano aquí).
// Permisos (del handoff, no inferidos): ver = caja.read + caja.ver_todos; abrir/contar =
// caja.create + caja.ver_todos; cerrar = caja.cerrar + caja.ver_todos.

export type CuadreTotalEstado = "abierto" | "cerrado";

// Una columna de la comprobación (consulta / general / suma de las dos / cuadre del día).
export interface ComprobacionColumna {
  expected: number;
  counted: number;
  fund: number;
  difference: number;
}

export interface ComprobacionCuadreTotal {
  consultation: ComprobacionColumna;
  general: ComprobacionColumna;
  sum: ComprobacionColumna;
  day: ComprobacionColumna;
  squares: boolean;
  gap: number;
}

// Mismo árbol que ReporteDia (el BE reusa el reporte del día, con `division`/`userId` en null: las dos
// divisiones juntas) más el estado del cuadre único y la comprobación. `documentos` trae la división de
// cada factura (campo opcional en ReporteDia, siempre presente aquí).
// `countMode` aquí reemplaza el de ReporteDia: en el cuadre TOTAL es el del DÍA completo
// ({mode, complete, warnings}), no el de una sola división ({mode, countRequired}).
export interface CuadreTotalDia extends Omit<ReporteDia, "countMode"> {
  dayReconciliation: { id: string; status: CuadreTotalEstado; ownCount: boolean } | null;
  check: ComprobacionCuadreTotal;
  // BE #566: con qué modo se cuenta este día. Un día CERRADO conserva el modo con el que se cerró
  // (no cambia si tesorería enciende el interruptor después); al reabrir, vuelve al del centro.
  countMode?: CashCountModeStatus;
  divisionCounts?: DivisionCounts;
}

export function getReporteCuadreTotal(fecha: string): Promise<CuadreTotalDia> {
  return apiFetch<CuadreTotalDia>(`/cash/total-reconciliation?fecha=${encodeURIComponent(fecha)}`);
}

// Abre o retoma (idempotente en el BE) el cuadre total de ese día. Devuelve su id.
export function abrirCuadreTotal(fecha: string): Promise<{ id: string; status: CuadreTotalEstado }> {
  return apiFetch<{ id: string; status: CuadreTotalEstado }>(`/cash/total-reconciliation`, {
    method: "POST",
    body: JSON.stringify({ fecha }),
  });
}

export function contarCuadreTotal(
  id: string,
  conteos: ConteoLinea[],
): Promise<unknown> {
  // Mismo DTO que contarCuadre (`ConteoLineaDto`, api-ingles lo traduce en /api/v2: `denominationId`/
  // `quantity`); el contenedor `conteos` tampoco se traduce aquí (igual que en contarCuadre). Vacío =
  // vuelve a "la suma de los dos consolidados" (handoff, §API).
  return apiFetch<unknown>(`/cash/total-reconciliation/${id}/count`, {
    method: "POST",
    body: JSON.stringify({ conteos }),
  });
}

// `countMode` null = la sesión no está en el centro de esa hoja (BE #566) → no mostrar avisos.
export function cerrarCuadreTotal(id: string): Promise<{ countMode?: CashCountModeStatus | null }> {
  return apiFetch<{ countMode?: CashCountModeStatus | null }>(`/cash/total-reconciliation/${id}/close`, {
    method: "POST",
  });
}

// El interruptor por centro (BE #566): GET es de lectura abierta (caja.read basta, trae `modes` para
// pintar las opciones sin inventarlas); PUT exige `caja.count_mode` (concesión explícita, ningún rol
// la trae por defecto). Un centro por llamada — varios en `centerIds` da 400.
export interface CashCountModeConfig {
  clinicId: string;
  clinicName: string;
  mode: CashCountMode;
  modes: CashCountMode[];
}
export function getCashCountMode(centerIds?: string[]): Promise<CashCountModeConfig[]> {
  const sp = new URLSearchParams();
  for (const id of centerIds ?? []) sp.append("centerIds", id);
  const qs = sp.toString();
  return apiFetch<CashCountModeConfig[]>(`/cash/count-mode${qs ? `?${qs}` : ""}`);
}
export function setCashCountMode(
  centroId: string,
  mode: CashCountMode,
): Promise<{ clinicId: string; previous: CashCountMode; current: CashCountMode }> {
  const sp = new URLSearchParams({ centerIds: centroId });
  return apiFetch(`/cash/count-mode?${sp.toString()}`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });
}

// «Procesar cierre» switch per center (BE #575). GET with caja.read; PUT with caja.count_mode on that
// center, one center per call. With false the two close endpoints answer 409 CASH_CLOSE_DISABLED
// (caja.error.closeDisabled): the button is hidden here and the API refuses it too.
export interface CashCloseSetting {
  clinicId: string;
  clinicName: string;
  closeEnabled: boolean;
}
export function getCashCloseSetting(centerIds?: string[]): Promise<CashCloseSetting[]> {
  const sp = new URLSearchParams();
  for (const id of centerIds ?? []) sp.append("centerIds", id);
  const qs = sp.toString();
  return apiFetch<CashCloseSetting[]>(`/cash/close-setting${qs ? `?${qs}` : ""}`);
}
export function setCashCloseSetting(
  centroId: string,
  closeEnabled: boolean,
): Promise<{ clinicId: string; previous: boolean; current: boolean }> {
  const sp = new URLSearchParams({ centerIds: centroId });
  return apiFetch(`/cash/close-setting?${sp.toString()}`, {
    method: "PUT",
    body: JSON.stringify({ closeEnabled }),
  });
}

// «El cuadre de un día pasado no se toca sin autorización» (BE PR #582-583, handoff
// .personal/handoff-bloqueo-dias-pasados.md): para pantallas que no tienen su propio `pastCashDay`
// en el GET principal (p. ej. la devolución) — `centerIds[0]` es obligatorio.
export type CashPastDayCheck = { day: string; reconciled: boolean; locked: boolean; canModify: boolean };
export function getCashPastDayCheck(fecha: string, centroId: string): Promise<CashPastDayCheck> {
  const sp = new URLSearchParams({ fecha, centerIds: centroId });
  return apiFetch<CashPastDayCheck>(`/cash/past-day-check?${sp.toString()}`);
}
