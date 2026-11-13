import { apiFetch } from "./client";

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
};
export function getRefundDetail(facturaId: string, devolucionId: string, centroId?: string): Promise<RefundDetail> {
  return apiFetch<RefundDetail>(`/invoices/${facturaId}/refunds/${devolucionId}`, {}, centroId);
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
