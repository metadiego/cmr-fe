import { test } from "node:test";
import assert from "node:assert/strict";

import { bookingSummary, clinicIsFixed, shiftDay, slotTone, startsWithChoiceMade, timeRange } from "./appointment-form.ts";

test("slotTone: no places left is full, one is low, more is open", () => {
  assert.equal(slotTone(0), "full");
  assert.equal(slotTone(-2), "full");
  assert.equal(slotTone(1), "low");
  assert.equal(slotTone(2), "open");
  assert.equal(slotTone(7), "open");
});

test("shiftDay moves a calendar day across month and year ends", () => {
  assert.equal(shiftDay("2026-11-20", 1), "2026-11-21");
  assert.equal(shiftDay("2026-11-20", -1), "2026-11-19");
  assert.equal(shiftDay("2026-11-30", 1), "2026-12-01");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
});

test("shiftDay ignores a time part and returns an empty day as is", () => {
  assert.equal(shiftDay("2026-11-20T00:00:00.000Z", 1), "2026-11-21");
  assert.equal(shiftDay("", 1), "");
});

test("timeRange shows start–end in HH:MM, or the start alone", () => {
  assert.equal(timeRange("07:00", "08:00"), "07:00–08:00");
  assert.equal(timeRange("07:00:00", "08:30:00"), "07:00–08:30");
  assert.equal(timeRange("07:00", ""), "07:00");
  assert.equal(timeRange("07:00", "07:00"), "07:00");
  assert.equal(timeRange("", "08:00"), "");
});

test("bookingSummary joins what is known and skips what is not", () => {
  assert.equal(
    bookingSummary(["Consulta (Nueva)", "jue, 20 nov", "07:00–08:00", "CMR Bayamon"]),
    "Consulta (Nueva) · jue, 20 nov · 07:00–08:00 · CMR Bayamon",
  );
  assert.equal(bookingSummary([null, "jue, 20 nov", "", undefined, "  ", "07:00"]), "jue, 20 nov · 07:00");
  assert.equal(bookingSummary([]), "");
});

test("startsWithChoiceMade: only a new appointment that arrives with type and time", () => {
  assert.equal(startsWithChoiceMade({ isEdit: false, typeId: "t1", time: "07:00" }), true);
  assert.equal(startsWithChoiceMade({ isEdit: true, typeId: "t1", time: "07:00" }), false);
  assert.equal(startsWithChoiceMade({ isEdit: false, typeId: "", time: "07:00" }), false);
  assert.equal(startsWithChoiceMade({ isEdit: false, typeId: "t1", time: undefined }), false);
});

test("clinicIsFixed: a time picked from one clinic's hours keeps that clinic", () => {
  assert.equal(clinicIsFixed({ isEdit: false, givenClinic: "bay", givenTime: "13:00" }), true);
  // No time chosen yet (patient record): the clinic is still a choice.
  assert.equal(clinicIsFixed({ isEdit: false, givenClinic: "bay", givenTime: undefined }), false);
  // No clinic given (top bar on «Ambos»): asked.
  assert.equal(clinicIsFixed({ isEdit: false, givenClinic: undefined, givenTime: "13:00" }), false);
  // Edit: an appointment never changes clinic; the dialog already hides the picker.
  assert.equal(clinicIsFixed({ isEdit: true, givenClinic: "bay", givenTime: "13:00" }), false);
});
