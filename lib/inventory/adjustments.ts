// Pure helpers of the multi-product adjustment form (components/inventario/adjustment-form.tsx).
import type { AdjustmentInput, AdjustmentSign } from "../api/inventory-adjustments.ts";

export interface DraftLine {
  key: string;
  productId: string;
  productName: string;
  quantity: string;
  sign: AdjustmentSign;
  notes: string;
}

export type DraftProblem = "noWarehouse" | "noReason" | "noNotes" | "noLines" | { line: number; field: "product" | "quantity" };

/** What blocks saving, in the order the person should fix it; [] = ready. Lines without a product are ignored if empty. */
export function draftProblems(d: { warehouseId: string; reason: string; notes: string; lines: DraftLine[] }): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (!d.warehouseId) out.push("noWarehouse");
  if (!d.reason) out.push("noReason");
  if (d.notes.trim().length < 3) out.push("noNotes");
  const used = d.lines.filter((l) => l.productId || l.quantity.trim());
  if (used.length === 0) out.push("noLines");
  d.lines.forEach((l, i) => {
    if (!l.productId && !l.quantity.trim()) return;
    if (!l.productId) out.push({ line: i, field: "product" });
    const q = Number(l.quantity.replace(",", "."));
    if (!(q > 0)) out.push({ line: i, field: "quantity" });
  });
  return out;
}

/** The request body: header + the filled lines (empty ones dropped), quantities as numbers. */
export function adjustmentPayload(d: {
  warehouseId: string;
  reason: string;
  notes: string;
  effectiveDate?: string;
  patientId?: string | null;
  lines: DraftLine[];
}): AdjustmentInput {
  return {
    warehouseId: d.warehouseId,
    reason: d.reason,
    notes: d.notes.trim(),
    ...(d.effectiveDate ? { effectiveDate: d.effectiveDate } : {}),
    ...(d.patientId ? { patientId: d.patientId } : {}),
    lines: d.lines
      .filter((l) => l.productId)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity.replace(",", ".")),
        sign: l.sign,
        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
      })),
  };
}

/** Net units of the draft: what enters minus what leaves. */
export function draftNet(lines: DraftLine[]): number {
  return lines.reduce((a, l) => {
    const q = Number(l.quantity.replace(",", "."));
    return l.productId && q > 0 ? a + (l.sign === "positivo" ? q : -q) : a;
  }, 0);
}

/** What the quantity box keeps from what was typed or pasted (cmr-be 19-nov: users typed «-5»). The amount is
 *  always positive — the direction is the Sale/Entra toggle — so a minus is stripped and reported, letting
 *  the form switch the line to «Sale». Only digits and one decimal separator survive. */
export function quantityInput(raw: string): { quantity: string; hadMinus: boolean } {
  const hadMinus = /[-−‒–]/.test(raw);
  let seenSep = false;
  const quantity = [...raw.replace(/[-−‒–\s]/g, "")]
    .filter((c) => {
      if (/\d/.test(c)) return true;
      if ((c === "." || c === ",") && !seenSep) return (seenSep = true);
      return false;
    })
    .join("");
  return { quantity, hadMinus };
}
