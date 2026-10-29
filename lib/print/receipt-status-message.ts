// The message the receipt page (/print/invoice/:id?embed=1) posts to the dialog that frames it, so
// the dialog knows whether the receipt loaded (enable Print) or failed (show why, offer a retry).
// Same-origin postMessage; both sides import this so the shape cannot drift.
export const RECEIPT_STATUS_MESSAGE = "cmr:receipt-status";

export type ReceiptStatusMessage = {
  type: typeof RECEIPT_STATUS_MESSAGE;
  status: "ready" | "error";
  /** Error only: the backend's reason, already translated for the user. */
  message?: string;
};

export function receiptStatusMessage(status: "ready" | "error", message?: string): ReceiptStatusMessage {
  return message === undefined ? { type: RECEIPT_STATUS_MESSAGE, status } : { type: RECEIPT_STATUS_MESSAGE, status, message };
}
