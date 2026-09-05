// Lock del bug off-by-one: una fecha solo-día NUNCA debe retroceder por zona horaria. Correr: `npm test`.
import test from "node:test";
import assert from "node:assert/strict";
import { formatFechaSolo, parseDayUTC } from "./fecha.ts";

test("fecha solo-día se formatea MM/DD/YYYY sin corrimiento", () => {
  assert.equal(formatFechaSolo("2026-07-21"), "07/21/2026");
});

test("no retrocede un día (el bug original: 07/21 salía 07/20)", () => {
  assert.notEqual(formatFechaSolo("2026-07-21"), "07/20/2026");
});

test("datetime con hora usa la fecha (parte de día)", () => {
  assert.equal(formatFechaSolo("2026-07-21T09:30:00-04:00"), "07/21/2026");
});

test("vacío/nulo → cadena vacía", () => {
  assert.equal(formatFechaSolo(""), "");
  assert.equal(formatFechaSolo(null), "");
  assert.equal(formatFechaSolo(undefined), "");
});

test("primer día del mes/año no se corre", () => {
  assert.equal(formatFechaSolo("2026-01-01"), "01/01/2026");
});

// --- parseDayUTC: the anchor that makes the day-only formats exact ---------------

test("parseDayUTC anchors the day at UTC noon", () => {
  const d = parseDayUTC("2026-07-21");
  assert.equal(d?.toISOString(), "2026-07-21T12:00:00.000Z");
});

test("parseDayUTC prints the SAME day in eastern and western zones", () => {
  const d = parseDayUTC("2026-09-04")!;
  const opts = { day: "numeric", month: "long", year: "numeric" } as const;
  // UTC (what the day-only formats pin), PR (west) and Tokyo (east).
  for (const timeZone of ["UTC", "America/Puerto_Rico", "Asia/Tokyo"]) {
    assert.match(
      new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(d),
      /September 4, 2026/,
    );
  }
});

test("parseDayUTC does not roll back on the first day of the month", () => {
  const d = parseDayUTC("2026-01-01")!;
  assert.equal(
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
    "January 2026",
  );
});

test("parseDayUTC takes the day part of a full datetime", () => {
  assert.equal(parseDayUTC("2026-07-21T09:30:00-04:00")?.toISOString(), "2026-07-21T12:00:00.000Z");
});

test("parseDayUTC returns null for empty/invalid input", () => {
  assert.equal(parseDayUTC(""), null);
  assert.equal(parseDayUTC(null), null);
  assert.equal(parseDayUTC("no-a-date"), null);
});
