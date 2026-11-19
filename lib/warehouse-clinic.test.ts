// The clinic of a write keyed by a warehouse (lib/warehouse-clinic.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { warehouseClinic, warehouseLabel, warehouseReady } from "./warehouse-clinic.ts";

const rows = [
  { id: "w1", name: "Principal", clinicId: "bay", clinicName: "CMR Bayamon" },
  { id: "w2", name: "Principal", clinicId: "cag", clinicName: "CMR Caguas" },
];

test("warehouse clinic: the picked warehouse's own clinic", () => {
  assert.equal(warehouseClinic(rows, "w2"), "cag");
});

test("warehouse clinic: nothing picked or unknown → undefined (the working clinic)", () => {
  assert.equal(warehouseClinic(rows, ""), undefined);
  assert.equal(warehouseClinic(rows, "gone"), undefined);
  assert.equal(warehouseClinic([{ id: "w3", name: "X", clinicId: null }], "w3"), undefined);
});

test("label: the clinic is named only when the list mixes clinics", () => {
  assert.equal(warehouseLabel(rows[1], rows), "Principal · CMR Caguas");
  assert.equal(warehouseLabel(rows[0], [rows[0]]), "Principal");
  assert.equal(warehouseLabel({ id: "w4", name: "Frio", clinicId: "cag" }, rows), "Frio");
});

test("ready: on «Ambos» a warehouse is required; otherwise the BE may pick the clinic's", () => {
  assert.equal(warehouseReady("", true), false);
  assert.equal(warehouseReady("w1", true), true);
  assert.equal(warehouseReady("", false), true);
});
