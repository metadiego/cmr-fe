import { test } from "node:test";
import assert from "node:assert/strict";

import { addDays, buildRecurringPlan, type RecurringPlanItem } from "./recurring-plan.ts";
import type { AvailabilitySlot } from "../api/resources.ts";

// buildRecurringPlan never books blindly — it must check real availability per candidate date, fall back
// to the closest fitting time on the same day, then search neighboring days, and never let two sessions
// of the same series collide with each other before either is actually saved. See recurring-plan.ts.

function slot(time: string, fits: boolean, freeStations = fits ? 1 : 0): AvailabilitySlot {
  return { time, fits, freeStations };
}

test("addDays: plain arithmetic, no month/year rollover surprises", () => {
  assert.equal(addDays("2026-09-26", 1), "2026-09-27");
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-09-26", -1), "2026-09-25");
});

test("every date has the requested time free: all asRequested", async () => {
  const fake = async () => ({ configured: true, slots: [slot("09:00", true, 3)] });
  const items = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 2, preferredTime: "09:00", count: 3 },
    fake,
  );
  assert.deepEqual(
    items.map((i) => [i.date, i.time, i.status]),
    [
      ["2026-09-26", "09:00", "asRequested"],
      ["2026-09-28", "09:00", "asRequested"],
      ["2026-09-30", "09:00", "asRequested"],
    ],
  );
});

test("requested time full that day, another time fits: adjustedTime, same date", async () => {
  const fake = async () => ({
    configured: true,
    slots: [slot("09:00", false, 0), slot("09:30", true, 1), slot("10:00", true, 2)],
  });
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 1, preferredTime: "09:00", count: 1 },
    fake,
  );
  assert.equal(item.date, "2026-09-26");
  assert.equal(item.time, "09:30"); // closest fitting time to 09:00
  assert.equal(item.status, "adjustedTime");
});

test("nothing fits that day: searches neighboring days, adjustedDate", async () => {
  const fake = async (date: string) => {
    if (date === "2026-09-27") return { configured: true, slots: [slot("09:00", true, 1)] };
    return { configured: true, slots: [slot("09:00", false, 0)] };
  };
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 1, preferredTime: "09:00", count: 1 },
    fake,
  );
  assert.equal(item.date, "2026-09-27");
  assert.equal(item.time, "09:00");
  assert.equal(item.status, "adjustedDate");
});

test("no fitting slot anywhere within the search window: unresolved, keeps the requested date/time", async () => {
  const fake = async () => ({ configured: true, slots: [slot("09:00", false, 0)] });
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 1, preferredTime: "09:00", count: 1, searchWindowDays: 2 },
    fake,
  );
  assert.equal(item.status, "unresolved");
  assert.equal(item.date, "2026-09-26");
  assert.equal(item.time, "09:00");
});

test("two sessions of the series never land on the SAME DATE, even at different times", async () => {
  // The BE dedupes agendar-multiple by (patient, service, date) — not date+time — so a date already used
  // by one item in this plan must be off the table for every other item, no matter which hour is free.
  // Every date in this fake has room at both 09:00 and 09:30; if the plan let two items share a date, this
  // test would still pass on "different times" alone, which is exactly the bug this guards against.
  const fake = async () => ({
    configured: true,
    slots: [slot("09:00", true, 2), slot("09:30", true, 2)],
  });
  const items = await buildRecurringPlan(
    // everyDays: 0 forces both candidates to REQUEST the same date on purpose.
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 0, preferredTime: "09:00", count: 2 },
    fake,
  );
  const dates = items.map((i: RecurringPlanItem) => i.date);
  assert.notEqual(dates[0], dates[1]);
  assert.equal(items[0].date, "2026-09-26");
  assert.equal(items[0].time, "09:00");
  assert.equal(items[1].status, "adjustedDate");
});

test("a date already used by an earlier item is skipped entirely during neighbor search", async () => {
  // Day 1 (2026-09-27) has room; day 0 (09-26) is full and day 2 (09-28) also has room. If item 1 (which
  // requests 09-26, finds nothing, and searches neighbors) were allowed to reuse 09-27 after item 0 already
  // claimed it, both would end up on 09-27 — which the BE would collapse into one session.
  const fake = async (date: string) => {
    if (date === "2026-09-26") return { configured: true, slots: [slot("09:00", false, 0)] };
    return { configured: true, slots: [slot("09:00", true, 1)] };
  };
  const items = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 1, preferredTime: "09:00", count: 2 },
    fake,
  );
  // item 0 requests 09-26 (full) -> neighbor search finds 09-27 first.
  assert.equal(items[0].date, "2026-09-27");
  // item 1 requests 09-27, but it's already used -> must NOT be offered again; falls through to 09-28.
  assert.equal(items[1].date, "2026-09-28");
});

test("existingDates (patient's pre-existing sessions) are treated as already used from the start", async () => {
  // The requested date already has a pending session of this same service for this patient (found via
  // the caller's own "already scheduled" lookup) — proposing it again would collide with that existing
  // session at booking time exactly like an in-plan collision, so it must be skipped too.
  const fake = async () => ({ configured: true, slots: [slot("09:00", true, 1)] });
  const [item] = await buildRecurringPlan(
    {
      serviceId: "svc",
      areas: 1,
      startDate: "2026-09-26",
      everyDays: 1,
      preferredTime: "09:00",
      count: 1,
      existingDates: ["2026-09-26"],
    },
    fake,
  );
  assert.equal(item.date, "2026-09-27");
  assert.equal(item.status, "adjustedDate");
});
