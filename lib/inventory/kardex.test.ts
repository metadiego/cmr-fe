import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultKardexRange, ownerClosing, readableDocument, sessionLabel, validRange } from "./kardex.ts";

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
