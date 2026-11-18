import { test } from "node:test";
import assert from "node:assert/strict";

import { therapyDayMissing } from "./therapy-day-missing.ts";

const full = { patientId: "p-1", serviceIds: ["s-1", "s-2"], date: "2026-11-18", time: "09:30" };

test("therapyDayMissing: no patient → patient listed", () => {
  assert.deepEqual(therapyDayMissing({ ...full, patientId: null }), ["patient"]);
});
test("therapyDayMissing: no therapy checked → therapies listed", () => {
  assert.deepEqual(therapyDayMissing({ ...full, serviceIds: [] }), ["therapies"]);
});
test("therapyDayMissing: blank date → date listed", () => {
  assert.deepEqual(therapyDayMissing({ ...full, date: "" }), ["date"]);
});
test("therapyDayMissing: therapies checked but no hour picked → hour listed", () => {
  assert.deepEqual(therapyDayMissing({ ...full, time: "" }), ["hour"]);
});
test("therapyDayMissing: empty scheduler → every field in on-screen order", () => {
  assert.deepEqual(therapyDayMissing({ patientId: undefined, serviceIds: [], date: "", time: "" }), [
    "patient",
    "therapies",
    "date",
    "hour",
  ]);
});
test("therapyDayMissing: all present → []", () => {
  assert.deepEqual(therapyDayMissing(full), []);
});
