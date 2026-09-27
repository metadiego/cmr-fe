import { test } from "node:test";
import assert from "node:assert/strict";

import { addDays, buildRecurringPlan, weekdayOf, type RecurringPlanItem } from "./recurring-plan.ts";
import type { AvailabilitySlot } from "../api/resources.ts";

// buildRecurringPlan never books blindly — it must check real availability per candidate date, fall back
// to the closest fitting time on the same day, then search FORWARD along the next occurrences of the same
// selected weekdays, and never let two sessions of the same series (or an existing one) collide with each
// other before either is actually saved. See recurring-plan.ts.

const SAT = 6; // 2026-09-26 is a Saturday
const MON = 1, WED = 3, FRI = 5;

function slot(time: string, fits: boolean, freeStations = fits ? 1 : 0): AvailabilitySlot {
  return { time, fits, freeStations };
}

test("addDays: plain arithmetic, no month/year rollover surprises", () => {
  assert.equal(addDays("2026-09-26", 1), "2026-09-27");
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-09-26", -1), "2026-09-25");
});

test("weekdayOf matches the real calendar (2026-09-26 is a Saturday)", () => {
  assert.equal(weekdayOf("2026-09-26"), SAT);
  assert.equal(weekdayOf("2026-09-28"), MON); // the following Monday
});

test("12 sessions on Mon/Wed/Fri starting a Monday span exactly 4 calendar weeks", async () => {
  const fake = async () => ({ configured: true, slots: [slot("09:00", true, 3)] });
  const items = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-28", weekdays: [MON, WED, FRI], preferredTime: "09:00", count: 12 },
    fake,
  );
  assert.equal(items.length, 12);
  assert.ok(items.every((i: RecurringPlanItem) => [MON, WED, FRI].includes(weekdayOf(i.date))));
  // 12 sessions / 3 days-a-week = 4 weeks: last date is 4 weeks (28 days) after the first Monday.
  assert.equal(items[0].date, "2026-09-28");
  assert.equal(items[11].date, addDays("2026-09-28", 25)); // 2026-10-23, the 4th Friday
});

test("requested time full that day, another time fits: adjustedTime, same date", async () => {
  const fake = async () => ({
    configured: true,
    slots: [slot("09:00", false, 0), slot("09:30", true, 1), slot("10:00", true, 2)],
  });
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-28", weekdays: [MON], preferredTime: "09:00", count: 1 },
    fake,
  );
  assert.equal(item.date, "2026-09-28");
  assert.equal(item.time, "09:30"); // closest fitting time to 09:00
  assert.equal(item.status, "adjustedTime");
});

test("nothing fits that day: searches the NEXT occurrence of the same weekday, never backward", async () => {
  // Only Mondays are eligible; the first Monday (09-28) is full, the second (10-05) has room.
  const fake = async (date: string) => {
    if (date === "2026-10-05") return { configured: true, slots: [slot("09:00", true, 1)] };
    return { configured: true, slots: [slot("09:00", false, 0)] };
  };
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-28", weekdays: [MON], preferredTime: "09:00", count: 1 },
    fake,
  );
  assert.equal(item.date, "2026-10-05");
  assert.equal(item.status, "adjustedDate");
});

test("no fitting slot within the search window: unresolved, keeps the requested date/time", async () => {
  const fake = async () => ({ configured: true, slots: [slot("09:00", false, 0)] });
  const [item] = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-28", weekdays: [MON], preferredTime: "09:00", count: 1, searchWindowOccurrences: 2 },
    fake,
  );
  assert.equal(item.status, "unresolved");
  assert.equal(item.date, "2026-09-28");
  assert.equal(item.time, "09:00");
});

test("two sessions of the series never land on the SAME DATE, even at different times", async () => {
  // Both weekdays selected (Mon and Wed) land requests on the same first Monday when count draws fast —
  // force it directly: two items that both request 2026-09-28 (via a 1-day count each on the same date)
  // must not both resolve there even though 09:00 and 09:30 both have room.
  const fake = async () => ({ configured: true, slots: [slot("09:00", true, 2), slot("09:30", true, 2)] });
  // weekdays: [MON] with count 2 naturally advances to the next Monday for item 2 — to actually force a
  // SAME-DATE collision attempt, simulate it via existingDates instead (covered by the next test) plus
  // this one confirming the natural walk never repeats a date on its own.
  const items = await buildRecurringPlan(
    { serviceId: "svc", areas: 1, startDate: "2026-09-28", weekdays: [MON], preferredTime: "09:00", count: 2 },
    fake,
  );
  const dates = items.map((i: RecurringPlanItem) => i.date);
  assert.notEqual(dates[0], dates[1]);
});

test("existingDates (patient's pre-existing sessions) are treated as already used", async () => {
  const fake = async () => ({ configured: true, slots: [slot("09:00", true, 1)] });
  const [item] = await buildRecurringPlan(
    {
      serviceId: "svc",
      areas: 1,
      startDate: "2026-09-28",
      weekdays: [MON],
      preferredTime: "09:00",
      count: 1,
      existingDates: ["2026-09-28"],
    },
    fake,
  );
  assert.equal(item.date, "2026-10-05"); // next Monday, since 09-28 is already taken
  assert.equal(item.status, "adjustedDate");
});

test("minTimeOnStartDate drops earlier slots on the start date only", async () => {
  const fake = async (date: string) => {
    if (date === "2026-09-28") return { configured: true, slots: [slot("07:00", true, 1), slot("11:00", true, 1)] };
    return { configured: true, slots: [slot("07:00", true, 1)] };
  };
  const items = await buildRecurringPlan(
    {
      serviceId: "svc",
      areas: 1,
      startDate: "2026-09-28",
      weekdays: [MON],
      preferredTime: "07:00",
      count: 2,
      minTimeOnStartDate: "10:00", // "now" is already past 07:00 today
    },
    fake,
  );
  assert.equal(items[0].date, "2026-09-28");
  assert.equal(items[0].time, "11:00"); // 07:00 is in the past today, bumped to the next fitting time
  assert.equal(items[0].status, "adjustedTime");
  // The following Monday isn't "today", so 07:00 is fine there — the floor doesn't leak past startDate.
  assert.equal(items[1].date, "2026-10-05");
  assert.equal(items[1].time, "07:00");
  assert.equal(items[1].status, "asRequested");
});
