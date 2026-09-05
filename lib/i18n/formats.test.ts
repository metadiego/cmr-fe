// The invariants that make the shared formats correct in BOTH languages.
//
// Formatting used to be built ad hoc at every call site: half pinned to "es-PR" (so an English
// session still read "septiembre"), half passed `undefined` (the BROWSER's language, not the
// app's). i18n/formats.ts is the single place that decides, and these are the two properties
// that must not silently regress. Run: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";

import { formats, BUSINESS_TIME_ZONE } from "../../i18n/formats.ts";

const dateTime = formats.dateTime as Record<string, { timeZone?: string }>;
const dayOnly = Object.keys(dateTime).filter((n) => n.startsWith("day") || n === "monthYear");
const instants = ["time", "dateAndTime"];

test("the day-only presets are all present", () => {
  assert.ok(dayOnly.length >= 6, `expected the day-only presets, found ${dayOnly.join(", ")}`);
});

test("every day-only format pins UTC", () => {
  // A calendar day is not a moment. Rendering "2026-07-21" in a real timezone is what produced
  // the "invoice shows yesterday" bug; pinning UTC (fed a UTC-noon date by parseDayUTC) is the
  // half of that fix that lives here. Dropping a timeZone would reintroduce it silently.
  for (const name of dayOnly) {
    assert.equal(dateTime[name].timeZone, "UTC", `${name} must pin UTC`);
  }
});

test("instant formats do NOT pin a zone, so they inherit clinic time", () => {
  // These render BE timestamps, which must follow the configured business timezone.
  for (const name of instants) {
    assert.equal(dateTime[name].timeZone, undefined, `${name} must not pin its own zone`);
  }
});

test("the 12-hour formats are the ones that carry language", () => {
  // hour12 is why these must follow the locale: the marker is translated ("p. m." vs "PM").
  // 24-hour clocks elsewhere in the app are digits only and are deliberately left alone.
  for (const name of instants) {
    assert.equal((dateTime[name] as { hour12?: boolean }).hour12, true);
  }
  const d = new Date("2026-09-04T18:30:00Z");
  const render = (locale: string) =>
    new Intl.DateTimeFormat(locale, { ...dateTime.time, timeZone: BUSINESS_TIME_ZONE }).format(d);
  assert.notEqual(render("es-PR"), render("en-US"));
});
