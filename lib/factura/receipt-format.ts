import type { Recibo } from "./build-recibo.ts";
import { formatFechaSolo } from "../format/fecha.ts";

// Formatting shared by the two ways a receipt is printed — <ReciboTermico> on screen/browser and the
// ESC/POS ticket sent through the print hub (lib/print/receipt-escpos.ts) — so both say exactly the same.

export const receiptMoney = (v: number) => `$${(Number(v) || 0).toFixed(2)}`;

// dd/mm vs mm/dd: PR uses the US order, MM/DD/YYYY, plus HH:MM:SS — matches the legacy receipt. A
// DAY-ONLY value ("2026-07-18", e.g. a return) is formatted without timezone shift and without time.
export function receiptDateParts(iso: string): { fecha: string; hora: string } {
  if (!iso) return { fecha: "—", hora: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { fecha: formatFechaSolo(iso), hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { fecha: iso, hora: "" };
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

// i18n key (namespace `receipt`) of the document title: quote (unissued draft), return or invoice.
export function receiptTitleKey(r: Pick<Recibo, "tipoDocumento">): "returnDoc" | "budgetDoc" | "invoice" {
  return r.tipoDocumento === "devolucion" ? "returnDoc" : r.tipoDocumento === "presupuesto" ? "budgetDoc" : "invoice";
}

// Footer text depends on the STATE: draft = quote footer; issued/paid/... = invoice footer.
export function receiptFooter(r: Pick<Recibo, "estado" | "empresa">): string | null {
  return r.estado === "borrador" ? (r.empresa?.quoteFooter ?? null) : (r.empresa?.invoiceFooter ?? null);
}

// "3 days × 8 areas" — each multiplier's label is resolved by the caller (data-driven fac.col.<key>).
export function multipliersText(m: Record<string, number>, label: (key: string) => string): string {
  return Object.entries(m).map(([k, v]) => `${v} ${label(k)}`).join(" × ");
}

export function hasMultipliers(it: { multiplicadores?: Record<string, number> }): boolean {
  return !!it.multiplicadores && Object.keys(it.multiplicadores).length > 0;
}
