// Check for the stock adjustment dialog (components/inventario/ajuste-modal.tsx). Same conditions the
// button used before, split into what is missing (empty fields) and what is wrong (a reason the
// button stays disabled). No quantity is computed here: the payload is built exactly as before.
//
//   · movement  → quantity (> 0), reason, notes
//   · count     → counted (must differ from the system stock), notes
//   · by vials  → something counted (closed vials or open content), notes
// A row without a warehouse cannot be adjusted at all.

import { deltaDelConteo } from "./ajuste.ts";

export type AdjustmentField = "quantity" | "reason" | "counted" | "vialCount" | "notes";
export type AdjustmentProblem = "noWarehouse" | "quantityInvalid" | "noDifference";

export type AdjustmentState = {
  mode: "movimiento" | "conteo";
  /** Count mode on a product with countable presentations. */
  byVials: boolean;
  hasWarehouse: boolean;
  quantity: string;
  reason: string;
  counted: string;
  stock: number;
  /** Whether the vial count produced a payload (something was counted). */
  vialsCounted: boolean;
  notes: string;
};

export function adjustmentCheck(s: AdjustmentState): {
  missing: AdjustmentField[];
  problem: AdjustmentProblem | null;
} {
  // The fields are not even shown without a warehouse: only the reason is.
  if (!s.hasWarehouse) return { missing: [], problem: "noWarehouse" };

  const missing: AdjustmentField[] = [];
  let problem: AdjustmentProblem | null = null;

  if (s.byVials) {
    if (!s.vialsCounted) missing.push("vialCount");
  } else if (s.mode === "conteo") {
    if (s.counted.trim() === "") missing.push("counted");
    else {
      const n = Number(s.counted);
      if (!Number.isFinite(n)) problem = "quantityInvalid";
      else if (deltaDelConteo(s.stock, n) === null) problem = "noDifference";
    }
  } else {
    if (s.quantity.trim() === "") missing.push("quantity");
    else {
      const n = Number(s.quantity);
      if (!(Number.isFinite(n) && n > 0)) problem = "quantityInvalid";
    }
    if (s.reason === "") missing.push("reason");
  }

  if (s.notes.trim() === "") missing.push("notes");
  return { missing, problem };
}
