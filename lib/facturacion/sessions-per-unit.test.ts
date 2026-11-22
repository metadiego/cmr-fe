import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultSessionsForLine, sessionsToSend } from "./sessions-per-unit.ts";

test("defaultSessionsForLine multiplies quantity by sessionsPerUnit", () => {
  assert.equal(defaultSessionsForLine(2, 4), 8);
  assert.equal(defaultSessionsForLine(1, 4), 4);
});

test("defaultSessionsForLine is null when the product has no sessionsPerUnit", () => {
  assert.equal(defaultSessionsForLine(2, null), null);
});

test("defaultSessionsForLine floors a fractional quantity and never drops below 1", () => {
  assert.equal(defaultSessionsForLine(2.9, 4), 8);
  assert.equal(defaultSessionsForLine(0, 4), 4);
  assert.equal(defaultSessionsForLine(-3, 4), 4);
});

test("sessionsToSend is undefined when the cashier never touched the field", () => {
  assert.equal(sessionsToSend(""), undefined);
  assert.equal(sessionsToSend("   "), undefined);
});

test("sessionsToSend parses a touched override", () => {
  assert.equal(sessionsToSend("6"), 6);
  assert.equal(sessionsToSend("6.9"), 6);
});

test("sessionsToSend never goes negative on garbage input", () => {
  assert.equal(sessionsToSend("-5"), 0);
  assert.equal(sessionsToSend("abc"), 0);
});
