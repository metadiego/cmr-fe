import { test } from "node:test";
import assert from "node:assert/strict";

import { balanceReason, capFor, otherCenters } from "./booking-cap.ts";

test("capFor caps at the bookable balance and defaults to it", () => {
  assert.deepEqual(capFor(10), { max: 10, defaultTotal: 10, limitedBy20: false });
  assert.deepEqual(capFor(20), { max: 20, defaultTotal: 20, limitedBy20: false });
});

test("capFor never goes past 20 per booking", () => {
  assert.deepEqual(capFor(35), { max: 20, defaultTotal: 20, limitedBy20: true });
});

test("capFor with no balance allows nothing", () => {
  assert.deepEqual(capFor(0), { max: 0, defaultTotal: 0, limitedBy20: false });
  assert.deepEqual(capFor(-2), { max: 0, defaultTotal: 0, limitedBy20: false });
});

test("capFor with an unknown balance applies only the 20 per booking", () => {
  assert.deepEqual(capFor(undefined), { max: 20, defaultTotal: 20, limitedBy20: true });
});

test("capFor follows the patient: switching patient gives the new patient's cap", () => {
  const first = capFor(12);
  const second = capFor(3);
  assert.equal(first.max, 12);
  assert.deepEqual(second, { max: 3, defaultTotal: 3, limitedBy20: false });
});

test("balanceReason blocks booking over the balance", () => {
  assert.equal(balanceReason(3, 2), "overBalance");
});

test("balanceReason blocks any booking without a balance", () => {
  assert.equal(balanceReason(1, 0), "noBalance");
  assert.equal(balanceReason(0, 0), "noBalance");
});

test("balanceReason lets rows up to the balance through", () => {
  assert.equal(balanceReason(2, 2), null);
  assert.equal(balanceReason(1, 5), null);
});

test("balanceReason does not decide while the balance is unknown", () => {
  assert.equal(balanceReason(30, undefined), null);
});

test("otherCenters names only other centers that still have sessions", () => {
  const sources = [
    { centerId: "bay", centerName: "CMR Bayamon", bookable: 4 },
    { centerId: "cag", centerName: "CMR Caguas", bookable: 2 },
    { centerId: "x", centerName: "Empty", bookable: 0 },
  ];
  assert.deepEqual(otherCenters(sources, "bay"), ["CMR Caguas"]);
  assert.deepEqual(otherCenters(sources, "cag"), ["CMR Bayamon"]);
  assert.deepEqual(otherCenters([], "bay"), []);
});
