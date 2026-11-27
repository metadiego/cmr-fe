import { test } from "node:test";
import assert from "node:assert/strict";

import { callcenterTabParams, canCallBack, formatMinSec, isLiveRowStale, pbxParam, quickRange } from "./callcenter-dashboard.ts";

test("callcenterTabParams: answered/missed/all map straight through", () => {
  assert.deepEqual(callcenterTabParams("answered"), { tab: "answered" });
  assert.deepEqual(callcenterTabParams("missed"), { tab: "missed" });
  assert.deepEqual(callcenterTabParams("all"), { tab: "all" });
});

test("callcenterTabParams: FB and TV are a channel filter over 'all', not their own tab", () => {
  assert.deepEqual(callcenterTabParams("facebook"), { tab: "all", channel: "facebook" });
  assert.deepEqual(callcenterTabParams("tv"), { tab: "all", channel: "tv" });
});

test("quickRange: today is a single-day range", () => {
  assert.deepEqual(quickRange("today", new Date("2026-11-26T15:00:00")), { from: "2026-11-26", to: "2026-11-26" });
});

test("quickRange: week starts Monday, even when today IS Monday", () => {
  // 2026-11-23 is a Monday.
  assert.deepEqual(quickRange("week", new Date("2026-11-23T09:00:00")), { from: "2026-11-23", to: "2026-11-23" });
  // Thursday the 26th → back to Monday the 23rd.
  assert.deepEqual(quickRange("week", new Date("2026-11-26T09:00:00")), { from: "2026-11-23", to: "2026-11-26" });
});

test("quickRange: week on a Sunday still goes back to THIS week's Monday, not next week's", () => {
  // 2026-11-29 is a Sunday; its Monday is 2026-11-23.
  assert.deepEqual(quickRange("week", new Date("2026-11-29T09:00:00")), { from: "2026-11-23", to: "2026-11-29" });
});

test("formatMinSec: formats seconds as m:ss with a zero-padded remainder", () => {
  assert.equal(formatMinSec(96), "1:36");
  assert.equal(formatMinSec(5), "0:05");
  assert.equal(formatMinSec(600), "10:00");
});

test("formatMinSec: never negative or NaN", () => {
  assert.equal(formatMinSec(-5), "0:00");
  assert.equal(formatMinSec(NaN), "0:00");
});

test("isLiveRowStale: a recent heartbeat is fresh", () => {
  const now = new Date("2026-11-26T15:00:00Z");
  const agentReportedAt = new Date("2026-11-26T14:58:00Z").toISOString();
  assert.equal(isLiveRowStale(agentReportedAt, now), false);
});

test("isLiveRowStale: an hour-old heartbeat is stale, never shown as live", () => {
  const now = new Date("2026-11-26T15:00:00Z");
  const agentReportedAt = new Date("2026-11-26T14:00:00Z").toISOString();
  assert.equal(isLiveRowStale(agentReportedAt, now), true);
});

test("isLiveRowStale: an unparseable timestamp is treated as stale, never as live", () => {
  assert.equal(isLiveRowStale("not-a-date", new Date()), true);
});

test("pbxParam: 'all' omits the param (today's combined behaviour); the others pass through", () => {
  assert.equal(pbxParam("all"), undefined);
  assert.equal(pbxParam("ucm-bayamon"), "ucm-bayamon");
  assert.equal(pbxParam("3cx"), "3cx");
});

test("canCallBack: entrante/facebook/marypili carry the patient's own number in `from`", () => {
  assert.equal(canCallBack({ from: "7871234567", address: "entrante" }), true);
  assert.equal(canCallBack({ from: "7871234567", address: "facebook" }), true);
  assert.equal(canCallBack({ from: "7871234567", address: "marypili" }), true);
});

test("canCallBack: an internal call is never callable back, even with a from", () => {
  assert.equal(canCallBack({ from: "2222", address: "interna" }), false);
});

test("canCallBack: a saliente call's `from` is OUR OWN extension, not the patient — never callable back", () => {
  // Real prod case this guards: an outbound call's `from` was "2257" (the operator's own
  // extension), which "Devolver" would otherwise have tried to call.
  assert.equal(canCallBack({ from: "2257", address: "saliente" }), false);
});

test("canCallBack: no number at all (blank or missing) is never callable back", () => {
  assert.equal(canCallBack({ from: null, address: "entrante" }), false);
  assert.equal(canCallBack({ from: "  ", address: "entrante" }), false);
});
