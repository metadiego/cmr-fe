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

test("two sessions of the series don't collide: the plan reserves locally as it allocates", async () => {
  // Only ONE free station at 09:00 that day — two candidates asking for the SAME day must not both get it.
  const fake = async () => ({
    configured: true,
    slots: [slot("09:00", true, 1), slot("09:30", true, 1)],
  });
  const items = await buildRecurringPlan(
    // everyDays: 0 forces both candidates onto the same requested date on purpose, to prove the local
    // reservation (not the BE) is what keeps them from doubling up on 09:00.
    { serviceId: "svc", areas: 1, startDate: "2026-09-26", everyDays: 0, preferredTime: "09:00", count: 2 },
    fake,
  );
  const times = items.map((i: RecurringPlanItem) => i.time).sort();
  assert.deepEqual(times, ["09:00", "09:30"]);
});
