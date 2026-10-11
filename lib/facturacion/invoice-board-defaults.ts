// The invoice list's standard columns (GET /invoices/board on a board nobody has customised), in order.
// The BE stays the source of truth: these only label the table while the first response is in flight, so
// the headers read as words instead of bars, and give each column its loading shape. A clinic that
// changed its board sees its own headers as soon as the board arrives.
export type InvoiceColumnShape = "short" | "long" | "text" | "badge" | "control";

export const DEFAULT_INVOICE_COLUMNS: readonly { clave: string; labelKey: string; shape: InvoiceColumnShape }[] = [
  { clave: "fac_numero", labelKey: "fac.col.numero", shape: "short" },
  { clave: "fac_fecha", labelKey: "fac.col.fecha", shape: "short" },
  { clave: "fac_paciente", labelKey: "fac.col.paciente", shape: "long" },
  { clave: "fac_medico", labelKey: "fac.col.medico", shape: "control" },
  { clave: "fac_usuario", labelKey: "fac.col.usuario", shape: "control" },
  { clave: "fac_estado", labelKey: "fac.col.estado", shape: "badge" },
  { clave: "fac_total", labelKey: "fac.col.total", shape: "short" },
  { clave: "fac_medio", labelKey: "fac.col.medio", shape: "text" },
];

/** Loading shape of a board column by its key; columns outside the standard set read as a word. */
export function invoiceColumnShape(clave: string): InvoiceColumnShape {
  return DEFAULT_INVOICE_COLUMNS.find((c) => c.clave === clave)?.shape ?? "text";
}
