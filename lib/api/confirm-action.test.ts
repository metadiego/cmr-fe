import { test } from "node:test";
import assert from "node:assert/strict";

import { askConfirmation, readConfirmation, setConfirmHandler } from "./confirm-action.ts";

const body = {
  code: "ACTION_REQUIRES_CONFIRMATION",
  labelKey: "confirmation.required",
  action: "frontdesk.unattend",
  actionLabelKey: "confirmation.action.unattend",
  effects: ["confirmation.effect.returnsPackageSession", "confirmation.effect.returnsStock", 7],
  params: { sessionId: "s1", date: "2026-11-06", from: "asistido", to: "pendiente" },
};

test("readConfirmation: the handoff's 428 body", () => {
  const r = readConfirmation(428, body);
  assert.equal(r?.action, "frontdesk.unattend");
  assert.equal(r?.actionLabelKey, "confirmation.action.unattend");
  assert.deepEqual(r?.effects, ["confirmation.effect.returnsPackageSession", "confirmation.effect.returnsStock"], "non-strings dropped");
  assert.equal(r?.params.from, "asistido");
});

test("readConfirmation: anything else is not the shield", () => {
  assert.equal(readConfirmation(409, body), null);
  assert.equal(readConfirmation(428, { code: "OTHER", action: "x" }), null);
  assert.equal(readConfirmation(428, { code: "ACTION_REQUIRES_CONFIRMATION" }), null, "no action → cannot repeat");
  assert.equal(readConfirmation(428, null), null);
});

test("askConfirmation: no dialog mounted answers no; a mounted one decides", async () => {
  assert.equal(await askConfirmation(readConfirmation(428, body)!), false);
  const off = setConfirmHandler(async (r) => r.action === "frontdesk.unattend");
  assert.equal(await askConfirmation(readConfirmation(428, body)!), true);
  off();
  assert.equal(await askConfirmation(readConfirmation(428, body)!), false);
});
