import { test } from "node:test";
import assert from "node:assert/strict";

import { rescheduleMissing } from "./reschedule-missing.ts";

const full = { date: "2026-11-20", doctorRequired: true, doctorId: "d-1", reason: "Patient asked" };

test("rescheduleMissing: all present → []", () => {
  assert.deepEqual(rescheduleMissing(full), []);
});
test("rescheduleMissing: no date → date listed", () => {
  assert.deepEqual(rescheduleMissing({ ...full, date: "" }), ["date"]);
});
test("rescheduleMissing: doctor required and none → doctor listed", () => {
  assert.deepEqual(rescheduleMissing({ ...full, doctorId: "" }), ["doctor"]);
});
test("rescheduleMissing: doctor not required → no doctor is fine", () => {
  assert.deepEqual(rescheduleMissing({ ...full, doctorRequired: false, doctorId: "" }), []);
});
test("rescheduleMissing: blank reason → reason listed", () => {
  assert.deepEqual(rescheduleMissing({ ...full, reason: " " }), ["reason"]);
});
test("rescheduleMissing: empty form → every field in on-screen order", () => {
  assert.deepEqual(rescheduleMissing({ ...full, date: "", doctorId: "", reason: "" }), ["date", "doctor", "reason"]);
});
