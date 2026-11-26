import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidDayRange, isValidHHMM, isValidLagAlertMinutes } from "./callcenter-settings-form.ts";

test("isValidHHMM: accepts zero-padded 24h times", () => {
  assert.equal(isValidHHMM("08:00"), true);
  assert.equal(isValidHHMM("23:59"), true);
  assert.equal(isValidHHMM("00:00"), true);
});

test("isValidHHMM: rejects out-of-range hours/minutes and malformed strings", () => {
  assert.equal(isValidHHMM("24:00"), false);
  assert.equal(isValidHHMM("08:60"), false);
  assert.equal(isValidHHMM("8:00"), false);
  assert.equal(isValidHHMM("08-00"), false);
  assert.equal(isValidHHMM(""), false);
});

test("isValidDayRange: start before end is valid", () => {
  assert.equal(isValidDayRange("08:00", "18:00"), true);
});

test("isValidDayRange: equal or reversed times are invalid — a zero/negative-width window", () => {
  assert.equal(isValidDayRange("08:00", "08:00"), false);
  assert.equal(isValidDayRange("18:00", "08:00"), false);
});

test("isValidDayRange: a malformed time on either side is invalid", () => {
  assert.equal(isValidDayRange("8:00", "18:00"), false);
  assert.equal(isValidDayRange("08:00", "25:00"), false);
});

test("isValidLagAlertMinutes: within 5-720 whole minutes", () => {
  assert.equal(isValidLagAlertMinutes(30), true);
  assert.equal(isValidLagAlertMinutes(5), true);
  assert.equal(isValidLagAlertMinutes(720), true);
});

test("isValidLagAlertMinutes: outside the range, or not a whole minute, is invalid", () => {
  assert.equal(isValidLagAlertMinutes(4), false);
  assert.equal(isValidLagAlertMinutes(721), false);
  assert.equal(isValidLagAlertMinutes(30.5), false);
  assert.equal(isValidLagAlertMinutes(NaN), false);
});
