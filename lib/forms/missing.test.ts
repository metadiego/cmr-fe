import { test } from "node:test";
import assert from "node:assert/strict";

import { footerState, missingFields } from "./missing.ts";

test("missingFields keeps the order of the failing checks", () => {
  assert.deepEqual(missingFields([["Paciente", true], ["Hora", false], ["Motivo", false]]), ["Hora", "Motivo"]);
});
test("missingFields drops duplicate labels", () => {
  assert.deepEqual(missingFields([["A o B", false], ["A o B", false]]), ["A o B"]);
});
test("footerState: nothing missing, nothing blocked → enabled, no hint", () => {
  assert.deepEqual(footerState({}), { disabled: false, hint: null });
});
test("footerState: missing disables and is the hint", () => {
  assert.deepEqual(footerState({ missing: ["Hora"] }), { disabled: true, hint: { kind: "missing", items: ["Hora"] } });
});
test("footerState: missing wins over reason", () => {
  assert.equal(footerState({ missing: ["Hora"], reason: "No cabe" }).hint?.kind, "missing");
});
test("footerState: reason alone is shown but does NOT disable", () => {
  assert.deepEqual(footerState({ reason: "No cabe" }), { disabled: false, hint: { kind: "reason", text: "No cabe" } });
});
test("footerState: blocked disables and shows its reason", () => {
  assert.deepEqual(footerState({ blocked: true, reason: "Sin permiso" }), { disabled: true, hint: { kind: "reason", text: "Sin permiso" } });
});
test("footerState: submitting disables", () => {
  assert.equal(footerState({ submitting: true }).disabled, true);
});
test("footerState: an empty reason counts as no reason", () => {
  assert.deepEqual(footerState({ reason: "" }), { disabled: false, hint: null });
});
