import test from "node:test";
import assert from "node:assert/strict";
import { franjaActual } from "./franja-actual.ts";

const horas = ["07:00", "08:00", "09:00", "11:00", "13:00"];

test("picks the exact match", () => {
  assert.equal(franjaActual(horas, "09:00"), "09:00");
});

test("picks the last franja before now when there's a gap (no 10:00 franja)", () => {
  assert.equal(franjaActual(horas, "09:45"), "09:00");
});

test("before the first franja: nothing is current yet", () => {
  assert.equal(franjaActual(horas, "06:30"), null);
});

test("after the last franja: the last one stays current for the rest of the day", () => {
  assert.equal(franjaActual(horas, "23:59"), "13:00");
});

test("no timed franjas at all: nothing to highlight", () => {
  assert.equal(franjaActual([], "10:00"), null);
});
