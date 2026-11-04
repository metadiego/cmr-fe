import { test } from "node:test";
import assert from "node:assert/strict";

import { calendarCenter } from "./calendar-center.ts";

test("calendarCenter is the screen's center when nothing is moving", () => {
  assert.equal(calendarCenter("bay", undefined), "bay");
  assert.equal(calendarCenter(undefined, undefined), undefined);
});

test("calendarCenter is the moving appointment's own center, whatever the screen shows", () => {
  assert.equal(calendarCenter("bay", { centerId: "cag" }), "cag");
  assert.equal(calendarCenter(undefined, { centerId: "cag" }), "cag");
});

test("calendarCenter falls back to the screen's center when the appointment has none", () => {
  assert.equal(calendarCenter("bay", { centerId: null }), "bay");
  assert.equal(calendarCenter("bay", {}), "bay");
});
