// lib/personal/day-changes.ts. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { NOT_COMING, dayChangeBody, dayChangeProblem, type DayChangeDraft } from "./day-changes.ts";

const draft = (over: Partial<DayChangeDraft>): DayChangeDraft => ({
  day: "2026-12-01", center: "bay", startTime: "", endTime: "", note: "", ...over,
});
const TODAY = "2026-11-28";

test("a past day cannot be set", () => {
  assert.equal(dayChangeProblem(draft({ day: "2026-11-27" }), TODAY), "pastDay");
  assert.equal(dayChangeProblem(draft({ day: TODAY }), TODAY), null);
});

test("with a center: both hours or neither, end after start", () => {
  assert.equal(dayChangeProblem(draft({ startTime: "08:00" }), TODAY), "bothHours");
  assert.equal(dayChangeProblem(draft({ startTime: "12:00", endTime: "08:00" }), TODAY), "endBeforeStart");
  assert.equal(dayChangeProblem(draft({ startTime: "08:00", endTime: "12:00" }), TODAY), null);
});

test("not coming: no hours", () => {
  assert.equal(dayChangeProblem(draft({ center: NOT_COMING, startTime: "08:00", endTime: "09:00" }), TODAY), "noHoursWhenAway");
  assert.equal(dayChangeProblem(draft({ center: NOT_COMING }), TODAY), null);
});

test("body: null center for not coming; hours and note only when given", () => {
  assert.deepEqual(dayChangeBody(draft({ center: NOT_COMING, note: "  médico  " })), { centerId: null, note: "médico" });
  assert.deepEqual(dayChangeBody(draft({ startTime: "08:00", endTime: "12:00" })), {
    centerId: "bay", startTime: "08:00", endTime: "12:00",
  });
});
