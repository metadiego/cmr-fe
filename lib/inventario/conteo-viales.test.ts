import { test } from "node:test";
import assert from "node:assert/strict";
import { conteoPayload, presentacionesContables, totalEnBase } from "./conteo-viales.ts";

const MG = "6c1f737d";
// Tirzepatide + B6 en Bayamón (8-oct-2026): la presentación genérica sin contenido no se cuenta.
const tirz = presentacionesContables([
  { id: "gen", name: "Tirzepatide", content: null, contentUnitId: null, active: true },
  { id: "v60", name: "Vial 60 mg / 3 mL (20 mg/mL) + B6", content: 60, contentUnitId: MG, active: true },
  { id: "v62", name: "Vial 62.5 mg / 5 mL (12.5 mg/mL) + B6", content: "62.5", contentUnitId: MG, active: true },
  { id: "old", name: "Vial retirado", content: 50, contentUnitId: MG, active: false },
]);

test("only active presentations with content are counted by container", () => {
  assert.deepEqual(tirz.map((p) => p.id), ["v60", "v62"]);
});

test("the real Bayamón count: 16 + 10 vials = 1585 mg before confirming", () => {
  assert.equal(totalEnBase(tirz, { v60: "16", v62: "10" }, "", MG), 1585);
  assert.equal(totalEnBase(tirz, { v60: "16", v62: "10" }, "30", MG), 1615);
});

test("a vial measured in another unit: no local preview (the BE converts)", () => {
  assert.equal(totalEnBase(tirz, { v60: "2" }, "", "ml-id"), null);
});

test("nothing counted: no preview and no request", () => {
  assert.equal(totalEnBase(tirz, {}, "", MG), null);
  assert.equal(conteoPayload({ productId: "p", warehouseId: "w", presentaciones: tirz, cerrados: { v60: "0" }, abiertos: " " }), null);
});

test("the body has only the presentations counted, and the open amount when given", () => {
  assert.deepEqual(conteoPayload({ productId: "p", warehouseId: "w", presentaciones: tirz, cerrados: { v60: "16", v62: "" }, abiertos: "30" }), {
    productId: "p",
    warehouseId: "w",
    containers: [{ presentationId: "v60", quantity: 16 }],
    countedQuantity: 30,
  });
});

test("zero vials and zero open is a real count (the fridge is empty), not 'nothing counted'", () => {
  assert.deepEqual(conteoPayload({ productId: "p", warehouseId: "w", presentaciones: tirz, cerrados: {}, abiertos: "0" }), {
    productId: "p", warehouseId: "w", containers: [], countedQuantity: 0,
  });
});
