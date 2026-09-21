import test from "node:test";
import assert from "node:assert/strict";
import { franjaActual } from "./franja-actual.ts";

// Bridge format: 12h, no leading zero, no AM/PM (see cmr-be's orden-cronologico-hora.ts).
// 7-12 = morning as-is, 1-6 = afternoon (+12h), already-24h is literal.
const horas = ["7:00", "8:00", "9:00", "11:00", "1:00", "3:00"]; // 7am..11am, 1pm, 3pm

test("picks the exact match", () => {
  assert.equal(franjaActual(horas, "09:00"), "9:00");
});

test("picks the last franja before now when there's a gap (no 10am franja)", () => {
  assert.equal(franjaActual(horas, "09:45"), "9:00");
});

test("before the first franja: nothing is current yet", () => {
  assert.equal(franjaActual(horas, "06:30"), null);
});

test("after the last franja: the last one stays current for the rest of the day", () => {
  assert.equal(franjaActual(horas, "23:59"), "3:00");
});

test("no timed franjas at all: nothing to highlight", () => {
  assert.equal(franjaActual([], "10:00"), null);
});

test("crosses noon into the ambiguous 1-6 afternoon range correctly", () => {
  assert.equal(franjaActual(horas, "13:30"), "1:00");
});

test("an already-24h hour (>= 13) is read literally, not re-mapped", () => {
  assert.equal(franjaActual(["9:00", "14:00"], "15:00"), "14:00");
});
