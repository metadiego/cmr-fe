import { test } from "node:test";
import assert from "node:assert/strict";

import { bookableCheckKey, unbookableTypeCheck } from "./unbookable-type.ts";

const bal = new Map([
  ["s1", { bookable: 3 }],
  ["s0", { bookable: 0 }],
]);
const base = {
  patientId: "p1",
  kind: "service" as const,
  typeId: "s9",
  center: "c1",
  checkedKey: null,
  moving: false,
  bookableState: "ok" as const,
  bookable: bal,
};

test("bookableCheckKey: patient + service + center; none without a patient or for a medical type", () => {
  assert.equal(bookableCheckKey({ patientId: "p1", kind: "service", typeId: "s1", center: "c1" }), "p1|s1|c1");
  assert.equal(bookableCheckKey({ patientId: undefined, kind: "service", typeId: "s1", center: "c1" }), null);
  assert.equal(bookableCheckKey({ patientId: "p1", kind: "medical", typeId: "m1", center: "c1" }), null);
  assert.equal(bookableCheckKey({ patientId: "p1", kind: "service", typeId: undefined, center: "c1" }), null);
});

test("unbookableTypeCheck: a service absent from the balance (or at 0) is cleared once the balance is in", () => {
  assert.equal(unbookableTypeCheck(base), "clear");
  assert.equal(unbookableTypeCheck({ ...base, typeId: "s0" }), "clear");
  assert.equal(unbookableTypeCheck({ ...base, typeId: "s1" }), "keep");
});

test("unbookableTypeCheck: undecided (wait) until the balance is ok", () => {
  for (const bookableState of ["idle", "loading", "fail"] as const) {
    assert.equal(unbookableTypeCheck({ ...base, bookableState, bookable: undefined }), "wait", bookableState);
  }
  assert.equal(unbookableTypeCheck({ ...base, bookable: undefined }), "wait");
});

test("unbookableTypeCheck: never while moving", () => {
  assert.equal(unbookableTypeCheck({ ...base, moving: true }), "wait");
});

test("unbookableTypeCheck: once per key, so a later reload (after booking the last session) keeps the type", () => {
  assert.equal(unbookableTypeCheck({ ...base, checkedKey: "p1|s9|c1" }), "done");
  assert.equal(unbookableTypeCheck({ ...base, checkedKey: "p2|s9|c1" }), "clear");
});

test("unbookableTypeCheck: nothing to check without a patient or for a medical type", () => {
  assert.equal(unbookableTypeCheck({ ...base, patientId: undefined }), "done");
  assert.equal(unbookableTypeCheck({ ...base, kind: "medical" }), "done");
});

test("unbookableTypeCheck: a move records its key when it starts, so ending the move keeps a fully booked service", () => {
  const atStart = bookableCheckKey({ patientId: "p1", kind: "service", typeId: "s0", center: "c1" });
  assert.equal(unbookableTypeCheck({ ...base, typeId: "s0", moving: true, checkedKey: atStart }), "done");
  assert.equal(unbookableTypeCheck({ ...base, typeId: "s0", moving: false, checkedKey: atStart }), "done");
});
