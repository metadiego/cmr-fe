import { apiFetch } from "./client";

// Change WHO charged a payment or made a refund, in one step (cmr-be #644, handoff
// docs/specs/cambiar-usuario-de-pago-y-devolucion-handoff.md). `userId` is a STAFF id (active).
// The center travels as centerIds so the permission resolves on the invoice's center.

const withCenter = (path: string, centerId?: string) => (centerId ? `${path}?centerIds=${encodeURIComponent(centerId)}` : path);

/** Same payment, same amount, nothing voided. Permission `factura.update`. */
export function reassignPaymentUser(invoiceId: string, paymentId: string, userId: string, centerId?: string): Promise<unknown> {
  return apiFetch(withCenter(`/invoices/${invoiceId}/payments/${paymentId}`, centerId), { method: "PATCH", body: JSON.stringify({ userId }) }, centerId);
}

/** The refund AND its active reimbursements move to that cashier. Permission `factura.refund.repair`. */
export function reassignRefundUser(invoiceId: string, refundId: string, userId: string, centerId?: string): Promise<unknown> {
  return apiFetch(withCenter(`/invoices/${invoiceId}/refunds/${refundId}`, centerId), { method: "PATCH", body: JSON.stringify({ userId }) }, centerId);
}

/** Change WHO VOIDED a voided refund (cmr-be #649): the void and the reimbursements it took down move to
 *  that person. Only on a voided refund (else 409 REFUND_NOT_VOIDED). On a past cash day the client's
 *  shared flow asks the reason and the confirmation (X-Change-Reason / X-Confirm-Action) by itself. */
export function reassignRefundVoider(invoiceId: string, refundId: string, staffId: string, centerId?: string): Promise<unknown> {
  return apiFetch(withCenter(`/invoices/${invoiceId}/refunds/${refundId}`, centerId), { method: "PATCH", body: JSON.stringify({ cancelledBy: staffId }) }, centerId);
}
