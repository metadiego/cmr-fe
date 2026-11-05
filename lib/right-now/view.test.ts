import { test } from "node:test";
import assert from "node:assert/strict";

import { attendedSplit, liveServices, minutesSince, ratePct, topSellers } from "./view.ts";

test("top sellers: best three by total", () => {
  const sales = {
    invoices: 0, bruto: 0, devuelto: 0, neto: 0, refunds: 0,
    sellers: [1, 5, 3, 9].map((t, i) => ({ userId: String(i), name: null, total: t })),
  };
  assert.deepEqual(topSellers(sales).map((s) => s.total), [9, 5, 3]);
  assert.deepEqual(topSellers(undefined), []);
});

test("attended vs pending bar widths add up to 100; empty day is 0/0", () => {
  const p = { present: 0, firstVisit: 0, followUp: 0, attended: 3, pending: 1 };
  assert.deepEqual(attendedSplit(p), { attended: 3, pending: 1, attendedPct: 75, pendingPct: 25 });
  assert.deepEqual(attendedSplit({ ...p, attended: 0, pending: 0 }), { attended: 0, pending: 0, attendedPct: 0, pendingPct: 0 });
});

test("answer rate 0..1 to a whole percent", () => {
  assert.equal(ratePct(0.876), 88);
  assert.equal(ratePct(undefined), 0);
});

test("services with no movement are hidden", () => {
  const s = (total: number, waiting = 0) => ({
    serviceId: String(total), name: "S", color: null, icon: null, total, waiting, inCare: 0, completed: 0,
    staffOnDuty: [], waitingList: [], completedList: [],
  });
  assert.equal(liveServices([s(0), s(2), s(0, 1)]).length, 2);
});

test("minutes waiting, floored; unknown is null", () => {
  const now = Date.parse("2026-11-04T15:30:00Z");
  assert.equal(minutesSince("2026-11-04T15:00:30Z", now), 29);
  assert.equal(minutesSince(null, now), null);
});
