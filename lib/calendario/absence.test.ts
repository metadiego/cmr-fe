import { test } from "node:test";
import assert from "node:assert/strict";

import { acceptBody, acceptableAll, dayPart } from "./absence.ts";

const eduardo = {
  staffId: "s1", staffName: "Eduardo Ortiz Rodriguez", candidates: [{ id: "s1", name: "Eduardo Ortiz Rodriguez" }],
  kind: "vacation" as const, startDate: "2026-11-02", endDate: "2026-11-02", startTime: null, endTime: null, confidence: "high" as const, reasonKey: null,
};
const yashira = {
  ...eduardo, staffId: null, staffName: null, kind: "leave" as const, confidence: "low" as const, reasonKey: "calendar.absence.ambiguousStaff",
  candidates: [{ id: "y1", name: "Yashira Del Valle Massa" }, { id: "y2", name: "Yashira Rivera" }],
};

test("acceptBody: the suggested person, or the namesake picked; no person → nothing to send", () => {
  assert.deepEqual(acceptBody(eduardo), { staffId: "s1", kind: "vacation" });
  assert.equal(acceptBody(yashira), null);
  assert.deepEqual(acceptBody(yashira, "y2"), { staffId: "y2", kind: "leave" });
  assert.deepEqual(acceptBody({ ...eduardo, endTime: "11:00" }), { staffId: "s1", kind: "vacation", endTime: "11:00" });
});

test("dayPart: Fabian arrives at 11:00; Britalie leaves at 16:00; a whole day", () => {
  assert.deepEqual(dayPart({ startTime: null, endTime: "11:00" }), { kind: "until", until: "11:00" });
  assert.deepEqual(dayPart({ startTime: "16:00", endTime: null }), { kind: "from", from: "16:00" });
  assert.deepEqual(dayPart({ startTime: null, endTime: null }), { kind: "whole" });
});

test("accept all: only high confidence with one person", () => {
  const rows = [{ id: "a", suggestion: eduardo }, { id: "b", suggestion: yashira }, { id: "c", suggestion: null }];
  assert.deepEqual(acceptableAll(rows).map((r) => r.id), ["a"]);
});
