import { apiFetch, apiFetchEnvelope } from "./client";
import type { ApiWarning } from "./types";

// Detalle de una devolución para «Ver devolución» (BE PR #577, handoff .personal/handoff-reparar-devolucion.md):
// MISMA puerta que el recibo (`factura.read`) pero trae lo que el recibo nunca necesitó imprimir —
// `notes`, TODOS los reembolsos (anulados incluidos, con quién y por qué) y `reimbursementGap` (cuánto
// de lo devuelto no tiene todavía por dónde salió el dinero). El recibo IMPRESO sigue en /receipt
// (lib/api/facturas.ts, getReciboDevolucion), sin tocar: esto es solo para la pantalla.
export type RefundItem = {
  id: string;
  invoiceItemId: string;
  productId: string;
  description: string;
  quantity: number;
  sessions: number;
  unitPrice: number;
  amount: number;
  taxAmount: number;
};
export type RefundReimbursement = {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  date: string | null;
  status: "activo" | "anulado";
  userId?: string | null;
  userName?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancellationReason?: string | null;
};
export type RefundDetail = {
  id: string;
  number: number | null;
  displayNumber: string;
  series: string | null;
  date: string | null;
  type: "total" | "parcial";
  policy: string;
  status: string; // activa | anulada
  reason: string | null;
  notes: string | null;
  userId: string | null;
  userName: string | null;
  invoiceId: string;
  invoiceNumber: string | null;
  patient: { firstName?: string; lastName?: string | null; displayName?: string | null; medicalRecordNumber?: string | null; documentId?: string | null } | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
  refundedAmount: number;
  refundedTax: number;
  items: RefundItem[];
  reimbursements: RefundReimbursement[];
  reimbursedAmount: number;
  reimbursementGap: number;
  // BE PR #580 («el editor en su sitio», handoff .personal/handoff-editar-devolucion-completa.md):
  // una fila por línea de la factura (y por componente de kit) — TODAS, no solo las ya devueltas.
  // `refundable` NO descuenta lo que YA está en ESTA misma devolución (solo lo devuelto en otras).
  balances?: RefundBalance[];
};
export type RefundBalance = {
  invoiceItemId: string;
  invoiceItemComponentId: string | null;
  description: string;
  unit: "sesiones" | "unidades";
  sold: number;
  delivered: number;
  refundedElsewhere: number;
  inThisRefund: number;
  refundable: number;
  suggestedUnitAmount: number | null;
  packageStatus?: string | null;
};
export function getRefundDetail(facturaId: string, devolucionId: string, centroId?: string): Promise<RefundDetail> {
  return apiFetch<RefundDetail>(`/invoices/${facturaId}/refunds/${devolucionId}`, {}, centroId);
}

// Editar la devolución ENTERA: simular (no escribe) y guardar comparten el mismo cuerpo y la misma
// forma de respuesta — `lines` es la lista COMPLETA de la devolución (una línea que no viene, o viene
// en 0, se elimina). `quantity` = sesiones en líneas de paquete, unidades en las demás; `amount`
// opcional (sin él, el BE propone el proporcional si la cantidad cambió). Los AVISOS viajan en
// `meta.warnings` (nunca bloquean solos — el centro los puede configurar para bloquear, y entonces
// el BE ya no deja escribir: 400 REFUND_EDIT_BLOCKED), por eso se usa apiFetchEnvelope en vez de
// apiFetch (que descarta meta). `changeReason` es una suposición razonable del nombre en inglés de
// `motivoCambio` (v1) — no verificado en vivo porque escribir en D-000028 no está autorizado;
// confirmar/corregir si el BE lo rechaza.
export type RefundEditLine = { invoiceItemId: string; invoiceItemComponentId?: string; quantity: number; amount?: number };
export type RefundEditBody = {
  lines: RefundEditLine[];
  date?: string;
  reason?: string;
  notes?: string;
  userId?: string;
  refundMethodId?: string;
  reimbursements?: { paymentMethodId: string; amount: number }[];
  changeReason?: string;
};
export type RefundEditWarning = ApiWarning & { mode?: "warn" | "block"; invoiceItemId?: string | null; params?: Record<string, unknown> };
export type RefundEditLineResult = {
  invoiceItemId: string;
  invoiceItemComponentId: string | null;
  productId: string;
  description: string;
  unit: "sesiones" | "unidades";
  quantity: number;
  delta: number;
  amount: number;
  taxAmount: number;
};
export type RefundEditResult = {
  lines: RefundEditLineResult[];
  removedLines: RefundEditLineResult[];
  packages: Array<{ packageId: string; refundedSessions: number; status: string }>;
  counters: Array<{ invoiceItemId: string; refundedSessions: number; refundedQuantity: number }>;
  inventory: Array<{ productId: string; delta: number }>;
  refundedAmount: number;
  refundedTax: number;
  type: "total" | "parcial";
  invoiceStatus: string;
  reimbursementGap: number;
  // Bloqueos de REGLA del centro (400 REFUND_EDIT_BLOCKED si se intenta guardar con esto no vacío) —
  // distinto de meta.warnings, que nunca bloquea.
  blocks: RefundEditWarning[];
};
export type RefundEditResponse = { result: RefundEditResult; warnings: RefundEditWarning[] };

async function callRefundEdit(
  method: "POST" | "PUT",
  facturaId: string,
  devolucionId: string,
  suffix: string,
  body: RefundEditBody,
  centroId?: string,
): Promise<RefundEditResponse> {
  const envelope = await apiFetchEnvelope<RefundEditResult>(
    `/invoices/${facturaId}/refunds/${devolucionId}${suffix}`,
    { method, body: JSON.stringify(body) },
    centroId,
  );
  return { result: envelope.data, warnings: (envelope.meta.warnings as RefundEditWarning[] | undefined) ?? [] };
}

// No escribe nada — vista previa en vivo.
export function simulateRefundEdit(facturaId: string, devolucionId: string, body: RefundEditBody, centroId?: string): Promise<RefundEditResponse> {
  return callRefundEdit("POST", facturaId, devolucionId, "/simulate", body, centroId);
}
// Guarda. Permiso `factura.refund.repair`; pide confirmación `refund.edit` (apiFetch/apiFetchEnvelope
// ya manejan el 428/X-Confirm-Action solos).
export function saveRefundEdit(facturaId: string, devolucionId: string, body: RefundEditBody, centroId?: string): Promise<RefundEditResponse> {
  return callRefundEdit("PUT", facturaId, devolucionId, "", body, centroId);
}

export type RefundHistoryEntry = {
  entityType: "refund" | "refund_line";
  action: string;
  changedFields?: Record<string, { before?: unknown; after?: unknown }> | null;
  actorName?: string | null;
  createdAt: string;
};
export function getRefundHistory(facturaId: string, devolucionId: string, centroId?: string): Promise<RefundHistoryEntry[]> {
  return apiFetch<RefundHistoryEntry[]>(`/invoices/${facturaId}/refunds/${devolucionId}/history`, {}, centroId);
}
// Motivo y notas (permiso `factura.refund.repair`).
export function updateRefund(
  facturaId: string,
  devolucionId: string,
  payload: { reason?: string; notes?: string },
  centroId?: string,
): Promise<RefundDetail> {
  return apiFetch<RefundDetail>(`/invoices/${facturaId}/refunds/${devolucionId}`, { method: "PATCH", body: JSON.stringify(payload) }, centroId);
}
// Reemplaza POR COMPLETO los reembolsos de la devolución (una o varias formas; deben sumar exacto a
// refundedAmount). El 428/X-Confirm-Action de siempre lo maneja apiFetch solo — no hay nada que hacer
// aquí aparte de llamarla. Permiso `factura.refund.repair`.
export function replaceRefundReimbursements(
  facturaId: string,
  devolucionId: string,
  payload: { reimbursements: { paymentMethodId: string; amount: number }[]; reason: string },
  centroId?: string,
): Promise<RefundDetail> {
  return apiFetch<RefundDetail>(`/invoices/${facturaId}/refunds/${devolucionId}/reimbursements`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
