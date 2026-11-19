// Clinics of an inventory transfer (lib/inventario/transfer-clinics.ts). Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { canReceiveTransfer, transferClinicName } from "./transfer-clinics.ts";

const names = new Map([["bay", "CMR Bayamon"]]);
const fromMap = (id: string) => names.get(id);

test("the name the BE resolved wins", () => {
  assert.equal(transferClinicName("CMR Caguas", "bay", fromMap), "CMR Caguas");
});

test("without a resolved name, the first lookup that knows the id gives it", () => {
  assert.equal(transferClinicName(null, "bay", () => "", fromMap), "CMR Bayamon");
});

test("an unknown clinic is null, never its uuid", () => {
  assert.equal(transferClinicName(undefined, "zzz", fromMap), null);
  assert.equal(transferClinicName(undefined, undefined, fromMap), null);
});

test("a pending transfer is receivable where the person holds inventario.recibir at its destination", () => {
  assert.equal(canReceiveTransfer({ status: "pendiente", destinationClinicId: "cag" }, ["bay", "cag"]), true);
});

test("not receivable when the destination is not one of those clinics, whatever the active clinic", () => {
  assert.equal(canReceiveTransfer({ status: "pendiente", destinationClinicId: "cag" }, ["bay"]), false);
});

test("a transfer that is no longer pending is never receivable", () => {
  assert.equal(canReceiveTransfer({ status: "recibida", destinationClinicId: "cag" }, ["cag"]), false);
});
