import { test } from "node:test";
import assert from "node:assert/strict";

import { canReopen, duplicatesReopen, hideCancelledRow, isSessionToday, skippedReasons } from "./reopen.ts";

const TODAY = "2026-11-07";

test("isSessionToday: a day or an instant on today; anything else is not", () => {
  assert.equal(isSessionToday("2026-11-07", TODAY), true);
  assert.equal(isSessionToday("2026-11-07T00:00:00.000Z", TODAY), true);
  assert.equal(isSessionToday("2026-11-06", TODAY), false);
  assert.equal(isSessionToday(null, TODAY), false);
  assert.equal(isSessionToday(undefined, TODAY), false);
});

test("canReopen: only a cancelled session of today", () => {
  assert.equal(canReopen("cancelada", "2026-11-07", TODAY), true);
  assert.equal(canReopen("cancelada", "2026-11-06", TODAY), false, "yesterday is never offered");
  assert.equal(canReopen("presente", "2026-11-07", TODAY), false, "an open session has nothing to reopen");
  assert.equal(canReopen("cancelada", null, TODAY), false, "no date = not offered");
});

test("hideCancelledRow: today's cancelled stay visible, other days' hide, open rows never hide", () => {
  assert.equal(hideCancelledRow("cancelada", "2026-11-07", TODAY), false);
  assert.equal(hideCancelledRow("cancelada", "2026-11-05", TODAY), true);
  assert.equal(hideCancelledRow("asistido", "2026-11-05", TODAY), false);
});

test("duplicatesReopen: only transitions that start solely from cancelada", () => {
  assert.equal(duplicatesReopen(["cancelada"]), true);
  assert.equal(duplicatesReopen(["cancelada", "presente"]), false);
  assert.equal(duplicatesReopen([]), false, "no restriction = applies everywhere, not a reopen");
  assert.equal(duplicatesReopen(null), false);
});

test("skippedReasons: grouped by code, known codes get their key, unknown ones keep the code", () => {
  const r = skippedReasons([
    { id: "a", code: "FRONTDESK_SESSION_SAME_DAY" },
    { id: "b", code: "FRONTDESK_SESSION_SAME_DAY" },
    { id: "c", code: "SOMETHING_NEW" },
  ]);
  assert.deepEqual(r, [
    { code: "FRONTDESK_SESSION_SAME_DAY", key: "frontdesk.error.sessionSameDay", n: 2 },
    { code: "SOMETHING_NEW", key: null, n: 1 },
  ]);
  assert.deepEqual(skippedReasons(undefined), []);
});
