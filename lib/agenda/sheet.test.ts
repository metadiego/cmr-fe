import { test } from "node:test";
import assert from "node:assert/strict";

import { cappedBySheet, isSheetSlotTaken, noSeatDays, sheetDown } from "./sheet.ts";

test("sheetDown: only a sheet that was read and did not answer", () => {
  assert.equal(sheetDown({ checkedAt: "2026-11-10T15:00:00Z", ok: false }), true);
  assert.equal(sheetDown({ checkedAt: "2026-11-10T15:00:00Z", ok: true }), false);
  assert.equal(sheetDown(null), false, "reservation off: null, nothing to say");
  assert.equal(sheetDown(undefined), false);
});

test("cappedBySheet: 'hoja' only — 'cupo' is our own slots, null has room", () => {
  assert.equal(cappedBySheet({ cappedBy: "hoja" }), true);
  assert.equal(cappedBySheet({ cappedBy: "cupo" }), false);
  assert.equal(cappedBySheet({ cappedBy: null }), false);
});

test("isSheetSlotTaken: the 409 code of the real body", () => {
  assert.equal(isSheetSlotTaken({ code: "SHEET_SLOT_TAKEN", labelKey: "sheet.slotTaken" }), true);
  assert.equal(isSheetSlotTaken({ code: "SHEET_UNAVAILABLE" }), false);
  assert.equal(isSheetSlotTaken(null), false);
});

test("noSeatDays: v2 `date`, v1 `fecha`, unique and sorted; anything else is ignored", () => {
  assert.deepEqual(
    noSeatDays({ sinAsiento: [{ serviceId: "a", date: "2026-11-14" }, { servicioId: "b", fecha: "2026-11-12" }, { serviceId: "c", date: "2026-11-14" }] }),
    ["2026-11-12", "2026-11-14"],
  );
  assert.deepEqual(noSeatDays({ creadas: [] }), []);
  assert.deepEqual(noSeatDays(null), []);
});
