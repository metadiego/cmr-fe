import { test } from "node:test";
import assert from "node:assert/strict";

import { fixAvailabilityInvalid, fixAvailabilityMissing } from "./fix-availability-missing.ts";

const total = (t: string, delivered = 3) => ({ multipliers: null, total: t, delivered });
const mult = (m: Record<string, string>) => ({ multipliers: m, total: "", delivered: 3 });

test("fixAvailabilityMissing: empty total sessions → listed", () => {
  assert.deepEqual(fixAvailabilityMissing(total("  ")), ["totalSessions"]);
});
test("fixAvailabilityMissing: each empty breakdown value → listed, in order", () => {
  assert.deepEqual(fixAvailabilityMissing(mult({ dias: "", areas: "2" })), ["mult.dias"]);
  assert.deepEqual(fixAvailabilityMissing(mult({ dias: "12", areas: " " })), ["mult.areas"]);
  assert.deepEqual(fixAvailabilityMissing(mult({ dias: "", areas: "" })), ["mult.dias", "mult.areas"]);
});
test("fixAvailabilityMissing: all present → []", () => {
  assert.deepEqual(fixAvailabilityMissing(total("12")), []);
  assert.deepEqual(fixAvailabilityMissing(mult({ dias: "12", areas: "1" })), []);
});
test("fixAvailabilityMissing: an empty breakdown object falls back to the total", () => {
  assert.deepEqual(fixAvailabilityMissing({ multipliers: {}, total: "", delivered: 0 }), ["totalSessions"]);
});
test("fixAvailabilityInvalid: total below what was delivered", () => {
  assert.equal(fixAvailabilityInvalid(total("2")), "belowDelivered");
  assert.equal(fixAvailabilityInvalid(total("3")), null);
  assert.equal(fixAvailabilityInvalid(total("")), null);
});
test("fixAvailabilityInvalid: a breakdown value of zero or less", () => {
  assert.equal(fixAvailabilityInvalid(mult({ dias: "0", areas: "1" })), "multiplierNotPositive");
  assert.equal(fixAvailabilityInvalid(mult({ dias: "-1", areas: "1" })), "multiplierNotPositive");
  assert.equal(fixAvailabilityInvalid(mult({ dias: "", areas: "1" })), null);
  assert.equal(fixAvailabilityInvalid(mult({ dias: "12", areas: "1" })), null);
});
