import { test } from "node:test";
import assert from "node:assert/strict";

import { externalSourceStale } from "./external-source.ts";

const base = {
  source: "legacy",
  day: "2026-11-11",
  generatedAt: "2026-11-11T12:00:00.000Z",
  receivedAt: "2026-11-11T12:00:00.000Z",
  staleAfterMinutes: 5,
  stale: false,
};

test("BE already says stale: stale regardless of the clock", () => {
  const now = new Date(base.receivedAt).getTime();
  assert.equal(externalSourceStale({ ...base, stale: true }, now), true);
});

test("fresh: inside staleAfterMinutes, BE says not stale", () => {
  const now = new Date(base.receivedAt).getTime() + 4 * 60_000;
  assert.equal(externalSourceStale(base, now), false);
});

test("the pusher died: no new SSE ever came, but the screen's own clock catches it", () => {
  const now = new Date(base.receivedAt).getTime() + 6 * 60_000;
  assert.equal(externalSourceStale(base, now), true);
});

test("unparseable receivedAt: never flagged stale by the clock alone", () => {
  assert.equal(externalSourceStale({ ...base, receivedAt: "not-a-date" }, Date.now()), false);
});
