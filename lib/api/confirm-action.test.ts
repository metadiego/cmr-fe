import { test } from "node:test";
import assert from "node:assert/strict";

import {
  askConfirmation,
  askPastDayReason,
  PAST_DAY_ACTION,
  readConfirmation,
  readPastDayConfirmation,
  readPastDayReasonRequired,
  setConfirmHandler,
  setPastDayHandler,
} from "./confirm-action.ts";

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

// «El cuadre de un día pasado no se toca sin autorización» (BE PR #582-583, handoff
// .personal/handoff-bloqueo-dias-pasados.md).
test("readPastDayReasonRequired: the 400 with no reason attached yet", () => {
  const r = readPastDayReasonRequired(400, { code: "CASH_PAST_DAY_REASON_REQUIRED", day: "2026-11-12" });
  assert.deepEqual(r, { day: "2026-11-12" });
  assert.equal(readPastDayReasonRequired(400, { code: "OTHER" }), null, "a different 400 is not this shield");
  assert.equal(readPastDayReasonRequired(428, { code: "CASH_PAST_DAY_REASON_REQUIRED" }), null, "wrong status");
});

const pastDayBody = {
  code: "ACTION_REQUIRES_CONFIRMATION",
  action: PAST_DAY_ACTION,
  actionLabelKey: "confirmation.action.modifyPastCashDay",
  effects: ["confirmation.effect.pastCashDayChanges"],
  params: {
    day: "2026-11-12",
    action: "payment.repair",
    signed: true,
    signatures: [{ role: "cashier", name: "Edgardo", signedAt: "2026-11-12T19:36:00Z" }],
    delta: [{ method: "Efectivo", amount: -220 }],
  },
};

test("readPastDayConfirmation: the past-day 428, kept separate from the generic shield", () => {
  const r = readPastDayConfirmation(428, pastDayBody);
  assert.equal(r?.day, "2026-11-12");
  assert.equal(r?.signed, true);
  assert.deepEqual(r?.delta, [{ method: "Efectivo", amount: -220 }]);
  assert.equal(r?.actionLabelKey, "confirmation.action.modifyPastCashDay");
  // The generic reader ignores it (different action): it must not double-fire the plain dialog.
  assert.equal(readConfirmation(428, pastDayBody)?.action, PAST_DAY_ACTION, "readConfirmation still SEES it (same envelope)");
  assert.equal(readPastDayConfirmation(428, { ...pastDayBody, action: "invoice.void" }), null, "a different action is not this shield");
});

test("askPastDayReason: no dialog mounted declines; a mounted one returns the typed reason", async () => {
  assert.equal(await askPastDayReason(readPastDayConfirmation(428, pastDayBody)!), null);
  const off = setPastDayHandler(async () => ({ reason: "corrección de pago" }));
  assert.deepEqual(await askPastDayReason(readPastDayConfirmation(428, pastDayBody)!), { reason: "corrección de pago" });
  off();
  assert.equal(await askPastDayReason(readPastDayConfirmation(428, pastDayBody)!), null);
});
