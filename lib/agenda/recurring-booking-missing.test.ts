import { test } from "node:test";
import assert from "node:assert/strict";

import { recurringBookingBlock, recurringBookingMissing } from "./recurring-booking-missing.ts";

const full = { startDate: "2026-11-18", time: "09:00", weekdayCount: 2 };

test("recurringBookingMissing: all present → []", () => {
  assert.deepEqual(recurringBookingMissing(full), []);
});
test("recurringBookingMissing: blank start date → startDate listed", () => {
  assert.deepEqual(recurringBookingMissing({ ...full, startDate: " " }), ["startDate"]);
});
test("recurringBookingMissing: no time → time listed", () => {
  assert.deepEqual(recurringBookingMissing({ ...full, time: "" }), ["time"]);
});
test("recurringBookingMissing: no weekday → weekdays listed", () => {
  assert.deepEqual(recurringBookingMissing({ ...full, weekdayCount: 0 }), ["weekdays"]);
});
test("recurringBookingMissing: empty form → every field in on-screen order", () => {
  assert.deepEqual(recurringBookingMissing({ startDate: "", time: "", weekdayCount: 0 }), ["startDate", "time", "weekdays"]);
});
test("recurringBookingBlock: no preview yet → noPreview", () => {
  assert.equal(recurringBookingBlock(null), "noPreview");
});
test("recurringBookingBlock: every row removed → noPreview", () => {
  assert.equal(recurringBookingBlock([]), "noPreview");
});
test("recurringBookingBlock: only unresolved dates → nothingBookable", () => {
  assert.equal(recurringBookingBlock([{ status: "unresolved" }]), "nothingBookable");
});
test("recurringBookingBlock: one bookable date → null", () => {
  assert.equal(recurringBookingBlock([{ status: "unresolved" }, { status: "adjustedTime" }]), null);
});
