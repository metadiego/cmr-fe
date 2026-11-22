import { test } from "node:test";
import assert from "node:assert/strict";

import { isOverdueInTherapy, countOverdueInTherapy } from "./queue-overdue.ts";

test("isOverdueInTherapy is false when the BE sent no estimate", () => {
  assert.equal(isOverdueInTherapy({ estimatedEnd: null }, "2026-11-20T15:00:00.000Z"), false);
});

test("isOverdueInTherapy is false before the estimated end", () => {
  assert.equal(
    isOverdueInTherapy({ estimatedEnd: "2026-11-20T15:30:00.000Z" }, "2026-11-20T15:00:00.000Z"),
    false,
  );
});

test("isOverdueInTherapy is true once the estimated end has passed", () => {
  assert.equal(
    isOverdueInTherapy({ estimatedEnd: "2026-11-20T14:30:00.000Z" }, "2026-11-20T15:00:00.000Z"),
    true,
  );
});

test("countOverdueInTherapy counts only the overdue entries", () => {
  const now = "2026-11-20T15:00:00.000Z";
  const entries = [
    { estimatedEnd: null },
    { estimatedEnd: "2026-11-20T14:30:00.000Z" },
    { estimatedEnd: "2026-11-20T15:30:00.000Z" },
    { estimatedEnd: "2026-11-20T10:00:00.000Z" },
  ];
  assert.equal(countOverdueInTherapy(entries, now), 2);
});
