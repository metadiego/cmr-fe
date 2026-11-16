import { test } from "node:test";
import assert from "node:assert/strict";

import { isUsableLine, protocolChangeInvalid, protocolChangeMissing } from "./protocol-change-missing.ts";

const line = { productoId: "p1", sesiones: "3" };
const ready = { originCount: 1, lines: [line], reason: "Clinical change" };

test("protocolChangeMissing: no pending package picked → origin", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, originCount: 0 }), ["origin"]);
});
test("protocolChangeMissing: no line has a product → product", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, lines: [{ productoId: "", sesiones: "3" }] }), ["product"]);
});
test("protocolChangeMissing: product chosen, sessions blank → sessions", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, lines: [{ productoId: "p1", sesiones: " " }] }), ["sessions"]);
});
test("protocolChangeMissing: blank reason → reason", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, reason: "  " }), ["reason"]);
});
test("protocolChangeMissing: empty form → every field in on-screen order", () => {
  assert.deepEqual(protocolChangeMissing({ originCount: 0, lines: [{ productoId: "", sesiones: "" }], reason: "" }), [
    "origin",
    "product",
    "reason",
  ]);
});
test("protocolChangeMissing: one usable line is enough (incomplete extra lines are left out)", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, lines: [line, { productoId: "", sesiones: "" }] }), []);
});
test("protocolChangeMissing: sessions filled but below 1 → not missing (it is invalid)", () => {
  assert.deepEqual(protocolChangeMissing({ ...ready, lines: [{ productoId: "p1", sesiones: "0" }] }), []);
});
test("protocolChangeMissing: all present → []", () => {
  assert.deepEqual(protocolChangeMissing(ready), []);
});

test("protocolChangeInvalid: sessions 0 or not a number → sessionsAtLeastOne", () => {
  assert.equal(protocolChangeInvalid([{ productoId: "p1", sesiones: "0" }]), "sessionsAtLeastOne");
  assert.equal(protocolChangeInvalid([{ productoId: "p1", sesiones: "abc" }]), "sessionsAtLeastOne");
});
test("protocolChangeInvalid: a usable line, or nothing filled → null", () => {
  assert.equal(protocolChangeInvalid([line, { productoId: "p2", sesiones: "0" }]), null);
  assert.equal(protocolChangeInvalid([{ productoId: "", sesiones: "" }]), null);
});
test("isUsableLine: product and sessions >= 1", () => {
  assert.equal(isUsableLine(line), true);
  assert.equal(isUsableLine({ productoId: "p1", sesiones: "0.5" }), false);
  assert.equal(isUsableLine({ productoId: "", sesiones: "2" }), false);
});
