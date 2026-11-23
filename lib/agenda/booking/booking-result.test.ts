import { test } from "node:test";
import assert from "node:assert/strict";

import { buildBookingResult, type BookingResultItem } from "./booking-result.ts";

const base = {
  mode: "booked" as const,
  patient: { name: "Ana", record: "123" },
  center: { name: "CMR Caguas" },
  skipped: [] as { date: string; reason: string }[],
  warnings: [] as string[],
};
const item = (date: string, time: string, typeName = "Consulta", extra: Partial<BookingResultItem> = {}): BookingResultItem => ({
  date,
  time,
  typeName,
  kind: "medical",
  ...extra,
});

test("buildBookingResult: sorts by date then time", () => {
  const r = buildBookingResult({
    ...base,
    items: [item("2026-12-02", "09:00"), item("2026-12-01", "14:00"), item("2026-12-01", "08:30")],
  });
  assert.deepEqual(
    r.items.map((i) => `${i.date} ${i.time}`),
    ["2026-12-01 08:30", "2026-12-01 14:00", "2026-12-02 09:00"],
  );
});

test("buildBookingResult: dedupes identical date+time+typeName, keeps different types", () => {
  const r = buildBookingResult({
    ...base,
    items: [item("2026-12-01", "08:00"), item("2026-12-01", "08:00"), item("2026-12-01", "08:00", "Laser")],
  });
  assert.equal(r.items.length, 2);
});

test("buildBookingResult: a skipped date that was also created is dropped from skipped", () => {
  const r = buildBookingResult({
    ...base,
    items: [item("2026-12-01", "08:00")],
    skipped: [
      { date: "2026-12-01", reason: "full" },
      { date: "2026-12-08", reason: "holiday" },
    ],
  });
  assert.deepEqual(r.skipped, [{ date: "2026-12-08", reason: "holiday" }]);
});

test("buildBookingResult: a moved item keeps its `from`", () => {
  const from = { date: "2026-12-01", time: "08:00" };
  const r = buildBookingResult({ ...base, mode: "moved", items: [item("2026-12-03", "10:00", "Consulta", { from })] });
  assert.deepEqual(r.items[0].from, from);
});
