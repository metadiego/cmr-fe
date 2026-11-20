import { test } from "node:test";
import assert from "node:assert/strict";

import { parseBookingParams, toBookingSearch } from "./url-state.ts";

test("parseBookingParams round-trips with toBookingSearch", () => {
  const s = {
    kind: "service" as const,
    typeId: "abc-123",
    date: "2026-11-10",
    patientId: "p1",
  };
  const search = toBookingSearch(s);
  assert.equal(search, "?type=service:abc-123&date=2026-11-10&patient=p1");
  assert.deepEqual(parseBookingParams(new URLSearchParams(search)), s);
});

test("toBookingSearch is empty when nothing is set and omits missing parts", () => {
  assert.equal(toBookingSearch({}), "");
  assert.equal(toBookingSearch({ date: "2026-11-10" }), "?date=2026-11-10");
});

test("parseBookingParams ignores malformed type and date", () => {
  const s = parseBookingParams(new URLSearchParams("type=foo:1&date=2026-13-40"));
  assert.deepEqual(s, {});
  assert.deepEqual(parseBookingParams(new URLSearchParams("date=2026-11-1")), {});
  assert.deepEqual(parseBookingParams(new URLSearchParams("type=medical:")), {});
});

test("view: day and week round-trip; month (the default) and junk stay out of the URL", () => {
  const s = { kind: "medical" as const, typeId: "t1", period: "week" as const };
  assert.equal(toBookingSearch(s), "?type=medical:t1&view=week");
  assert.deepEqual(parseBookingParams(new URLSearchParams("type=medical:t1&view=week")), s);
  assert.deepEqual(parseBookingParams(new URLSearchParams("view=day")), { period: "day" });
  assert.equal(toBookingSearch({ period: "month" }), "");
  assert.deepEqual(parseBookingParams(new URLSearchParams("view=month")), {});
  assert.deepEqual(parseBookingParams(new URLSearchParams("view=year")), {});
});
