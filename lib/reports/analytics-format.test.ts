import { test } from "node:test";
import assert from "node:assert/strict";

import { formatDimensionValue, dimensionLabel } from "./analytics-format.ts";

// Fake next-intl `t`: resolves a handful of real keys from messages/es.json (weekday/kind/dim/none)
// without pulling in the whole i18n runtime — enough to catch a typo in the key path.
const KEYS: Record<string, string> = {
  "reports.analytics.none": "Sin asignar",
  "reports.analytics.weekday.monday": "Lunes",
  "reports.analytics.kind.appointment": "Cita médica",
  "reports.analytics.dim.seller": "Vendedor",
};
const fakeT = Object.assign(
  (key: string) => KEYS[key] ?? key,
  { has: (key: string) => key in KEYS },
) as unknown as Parameters<typeof formatDimensionValue>[4];

// Fake useFormatter(): returns the UTC date it was given, ISO-stamped, so the test can assert the
// CORRECT date was built (noon UTC, no off-by-one from local timezone) without depending on a real
// locale's month-name output.
const fakeFormat = { dateTime: (d: Date) => d.toISOString() } as unknown as Parameters<typeof formatDimensionValue>[3];

test("formatDimensionValue: weekday translates via reports.analytics.weekday.<lowercase>", () => {
  assert.equal(formatDimensionValue("weekday", "Monday", null, fakeFormat, fakeT), "Lunes");
});
test("formatDimensionValue: an untranslated weekday falls back to the BE's raw string", () => {
  assert.equal(formatDimensionValue("weekday", "Friday", null, fakeFormat, fakeT), "Friday");
});
test("formatDimensionValue: kind translates via reports.analytics.kind.<raw>", () => {
  assert.equal(formatDimensionValue("kind", "appointment", null, fakeFormat, fakeT), "Cita médica");
});
test("formatDimensionValue: null group value = unassigned, never the BE's raw null", () => {
  assert.equal(formatDimensionValue("seller", null, null, fakeFormat, fakeT), "Sin asignar");
});
test("formatDimensionValue: month builds a UTC date at the 1st, noon (no local-timezone drift)", () => {
  assert.equal(formatDimensionValue("month", "2026-11", null, fakeFormat, fakeT), "2026-11-01T12:00:00.000Z");
});
test("formatDimensionValue: day builds a UTC date at noon (same anchor as parseDayUTC)", () => {
  assert.equal(formatDimensionValue("day", "2026-11-05", null, fakeFormat, fakeT), "2026-11-05T12:00:00.000Z");
});
test("formatDimensionValue: hour pads to HH:00, no translation needed", () => {
  assert.equal(formatDimensionValue("hour", "9", null, fakeFormat, fakeT), "09:00");
  assert.equal(formatDimensionValue("hour", "14", null, fakeFormat, fakeT), "14:00");
});
test("formatDimensionValue: other dimensions use the BE's label, raw as fallback", () => {
  assert.equal(formatDimensionValue("seller", "abc-123", "Michelle Padilla", fakeFormat, fakeT), "Michelle Padilla");
  assert.equal(formatDimensionValue("seller", "abc-123", null, fakeFormat, fakeT), "abc-123");
});

test("dimensionLabel: a known dimension resolves its column header", () => {
  assert.equal(dimensionLabel("seller", fakeT), "Vendedor");
});
test("dimensionLabel: an unmapped dimension falls back to the raw key, never throws", () => {
  assert.equal(dimensionLabel("nonsense", fakeT), "nonsense");
});
