import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultKardexRange, groupKardexDayMovements, ownerClosing, readableDocument, sessionLabel, validRange } from "./kardex.ts";
import type { KardexDayMovement } from "@/lib/api/inventory-kardex";

const movement = (over: Partial<KardexDayMovement>): KardexDayMovement => ({
  id: "m1",
  effectiveDate: "2026-11-18",
  type: "salida",
  reason: "aplicacion",
  kardexColumn: "aplicadas",
  signedQuantity: 0,
  openVial: false,
  documentType: "aplicacion",
  documentId: null,
  notes: null,
  patient: null,
  medicalRecordNumber: null,
  sessionNumber: null,
  sessionsTotal: null,
  ...over,
});

test("defaultKardexRange: first of the month through today", () => {
  assert.deepEqual(defaultKardexRange("2026-11-16"), { from: "2026-11-01", to: "2026-11-16" });
  assert.deepEqual(defaultKardexRange("2026-12-01"), { from: "2026-12-01", to: "2026-12-01" });
});

test("sessionLabel: n/m only when both are known (0 is a value)", () => {
  assert.equal(sessionLabel(3, 10), "3/10");
  assert.equal(sessionLabel(0, 4), "0/4");
  assert.equal(sessionLabel(3, null), null);
  assert.equal(sessionLabel(undefined, 10), null);
});

test("readableDocument: a transfer number shows, a UUID or blank does not", () => {
  assert.equal(readableDocument("T-000123"), "T-000123");
  assert.equal(readableDocument("5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d"), null);
  assert.equal(readableDocument("  "), null);
  assert.equal(readableDocument(null), null);
});

test("validRange: two days in order", () => {
  assert.equal(validRange("2026-11-01", "2026-11-16"), true);
  assert.equal(validRange("2026-11-16", "2026-11-16"), true);
  assert.equal(validRange("2026-11-17", "2026-11-16"), false);
  assert.equal(validRange("", "2026-11-16"), false);
});

test("groupKardexDayMovements: one delivery's vial + content rows collapse to one group", () => {
  const groups = groupKardexDayMovements([
    movement({ id: "a", documentId: "doc-1", patient: { id: "p", medicalRecordNumber: "15878", name: "CRUZ CASILLAS, CARMEN" }, sessionNumber: 1, sessionsTotal: 3, openVial: false, signedQuantity: -1 }),
    movement({ id: "b", documentId: "doc-1", patient: { id: "p", medicalRecordNumber: "15878", name: "CRUZ CASILLAS, CARMEN" }, sessionNumber: 1, sessionsTotal: 3, openVial: true, signedQuantity: -15 }),
    movement({ id: "c", documentId: "doc-1", patient: { id: "p", medicalRecordNumber: "15878", name: "CRUZ CASILLAS, CARMEN" }, sessionNumber: 1, sessionsTotal: 3, openVial: true, signedQuantity: -10 }),
  ]);
  assert.deepEqual(groups, [
    { key: "doc-1", patientName: "CRUZ CASILLAS, CARMEN", medicalRecordNumber: "15878", sessionNumber: 1, sessionsTotal: 3, vials: -1, content: -25, retroactiveRecordedAt: null },
  ]);
});

test("groupKardexDayMovements: a reversal nets against the vial count in the same group", () => {
  const groups = groupKardexDayMovements([
    movement({ id: "a", documentId: "doc-2", openVial: false, signedQuantity: 1 }), // devolución
    movement({ id: "b", documentId: "doc-2", openVial: false, signedQuantity: -1 }), // apertura_vial
    movement({ id: "c", documentId: "doc-2", openVial: true, signedQuantity: -10 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].vials, 0);
  assert.equal(groups[0].content, -10);
});

test("groupKardexDayMovements: two vials opened in one delivery sum into one group", () => {
  const groups = groupKardexDayMovements([
    movement({ id: "a", documentId: "doc-3", openVial: true, signedQuantity: -25 }),
    movement({ id: "b", documentId: "doc-3", openVial: false, signedQuantity: -1 }),
    movement({ id: "c", documentId: "doc-3", openVial: true, signedQuantity: -5 }),
    movement({ id: "d", documentId: "doc-3", openVial: false, signedQuantity: -1 }),
    movement({ id: "e", documentId: "doc-3", openVial: true, signedQuantity: -10 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].vials, -2);
  assert.equal(groups[0].content, -40);
});

test("groupKardexDayMovements: no documentId never merges with another row", () => {
  const groups = groupKardexDayMovements([
    movement({ id: "a", documentId: null, openVial: false, signedQuantity: 50 }),
    movement({ id: "b", documentId: null, openVial: false, signedQuantity: -2 }),
  ]);
  assert.equal(groups.length, 2);
});

test("groupKardexDayMovements: order of first appearance is kept", () => {
  const groups = groupKardexDayMovements([
    movement({ id: "a", documentId: "doc-b", signedQuantity: -1 }),
    movement({ id: "b", documentId: "doc-a", signedQuantity: -1 }),
    movement({ id: "c", documentId: "doc-b", signedQuantity: -1 }),
  ]);
  assert.deepEqual(groups.map((g) => g.key), ["doc-b", "doc-a"]);
});

test("groupKardexDayMovements: a backdated movement marks its row with when it was written", () => {
  const [g, h] = groupKardexDayMovements([
    movement({ id: "a", documentId: "adj-1", signedQuantity: 2, isRetroactive: true, recordedAt: "2026-11-19T15:00:00.000Z" }),
    movement({ id: "b", documentId: "doc-2", signedQuantity: -1 }),
  ]);
  assert.equal(g.retroactiveRecordedAt, "2026-11-19T15:00:00.000Z");
  assert.equal(h.retroactiveRecordedAt, null);
});

test("ownerClosing: the owner's October sheet closes at 133", () => {
  const october = {
    opening: 158,
    inbound: [{ quantity: 100 }, { quantity: 100 }, { quantity: 160 }],
    manualOutputs: [{ quantity: 1 }, { quantity: 1 }],
    appliedNet: 383,
    correctionsNet: 0,
  };
  assert.equal(ownerClosing(october), 133);
  // manual outputs counted as outputs whatever their sign
  assert.equal(ownerClosing({ ...october, manualOutputs: [{ quantity: -1 }, { quantity: -1 }] }), 133);
  assert.equal(ownerClosing({ ...october, correctionsNet: 2 }), 135);
});
