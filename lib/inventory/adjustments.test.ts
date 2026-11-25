import { test } from "node:test";
import assert from "node:assert/strict";

import { addProductLine, adjustmentPayload, draftNet, draftProblems, type DraftLine, quantityInput } from "./adjustments.ts";

const line = (o: Partial<DraftLine> = {}): DraftLine => ({ key: "k", productId: "p1", productName: "A", quantity: "2", sign: "negativo", notes: "", ...o });

test("draftProblems: header first, then each line by index; an empty trailing line is ignored", () => {
  assert.deepEqual(draftProblems({ warehouseId: "", reason: "", notes: "", lines: [] }), ["noWarehouse", "noReason", "noNotes", "noLines"]);
  assert.deepEqual(
    draftProblems({ warehouseId: "w", reason: "merma", notes: "rotos", lines: [line(), line({ productId: "", quantity: "1" }), line({ quantity: "0" }), line({ productId: "", quantity: "" })] }),
    [{ line: 1, field: "product" }, { line: 2, field: "quantity" }],
  );
  assert.deepEqual(draftProblems({ warehouseId: "w", reason: "merma", notes: "rotos", lines: [line({ quantity: "1,5" })] }), []);
});

test("adjustmentPayload: drops empty lines, numbers the quantities, optional fields only when set", () => {
  const body = adjustmentPayload({ warehouseId: "w", reason: "merma", notes: " rotos ", lines: [line({ notes: " x " }), line({ productId: "" })] });
  assert.deepEqual(body, { warehouseId: "w", reason: "merma", notes: "rotos", lines: [{ productId: "p1", quantity: 2, sign: "negativo", notes: "x" }] });
  const withAll = adjustmentPayload({ warehouseId: "w", reason: "r", notes: "abc", effectiveDate: "2026-11-17", patientId: "pt", lines: [line()] });
  assert.equal(withAll.effectiveDate, "2026-11-17");
  assert.equal(withAll.patientId, "pt");
});

test("draftNet: in minus out, ignoring incomplete lines", () => {
  assert.equal(draftNet([line({ quantity: "5", sign: "positivo" }), line({ quantity: "2" }), line({ productId: "", quantity: "9" })]), 3);
});

test("quantityInput strips the minus (the toggle gives the direction) and keeps one separator", () => {
  assert.deepEqual(quantityInput("-5"), { quantity: "5", hadMinus: true });
  assert.deepEqual(quantityInput("\u22122,5"), { quantity: "2,5", hadMinus: true });
  assert.deepEqual(quantityInput("12.5.3a"), { quantity: "12.53", hadMinus: false });
  assert.deepEqual(quantityInput("-"), { quantity: "", hadMinus: true });
  assert.deepEqual(quantityInput("0"), { quantity: "0", hadMinus: false });
});

test("adding a product: appended in pick order, never twice (the existing line is pointed at)", () => {
  const a = addProductLine([], { id: "p1", name: "BPC" }, "k1");
  assert.equal(a.existed, false);
  assert.deepEqual(a.lines.map((l) => [l.key, l.productId, l.productName, l.quantity, l.sign]), [["k1", "p1", "BPC", "", "negativo"]]);
  const b = addProductLine(a.lines, { id: "p2", name: "GLP" }, "k2");
  assert.deepEqual(b.lines.map((l) => l.productId), ["p1", "p2"]);
  const again = addProductLine(b.lines, { id: "p1", name: "BPC" }, "k3");
  assert.equal(again.existed, true);
  assert.equal(again.key, "k1");
  assert.equal(again.lines.length, 2);
});
