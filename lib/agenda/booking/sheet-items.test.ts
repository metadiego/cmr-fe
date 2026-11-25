import { test } from "node:test";
import assert from "node:assert/strict";

import type { BookingResult, BookingResultItem } from "./booking-result.ts";
import { sheetItems, type SameDayAppointment } from "./sheet-items.ts";

const booked = (date: string, time: string, typeName: string, kind: BookingResultItem["kind"] = "service"): BookingResultItem => ({
  date,
  time,
  typeName,
  kind,
});

const result = (items: BookingResultItem[]): BookingResult => ({
  mode: "booked",
  patient: { id: "p1", name: "Ana" },
  center: { id: "bay", name: "CMR Bayamon" },
  items,
  skipped: [],
  warnings: [],
});

const appt = (o: Partial<SameDayAppointment> & Pick<SameDayAppointment, "typeId" | "date">): SameDayAppointment => ({
  kind: "service",
  time: null,
  isLive: true,
  withLabel: null,
  centerId: "bay",
  ...o,
});

const NAMES: Record<string, string> = { prp: "TERAPIA PRP", vitc: "SUERO VITAMINA C", laser: "LASER", cons: "CONSULTA NUEVA" };
const nameOf = (_kind: SameDayAppointment["kind"], id: string) => NAMES[id];

test("sheetItems: the patient's other service appointments that same day are added, in time order", () => {
  const items = sheetItems(result([booked("2026-12-09", "11:00", "TERAPIA PRP")]), [
    appt({ typeId: "prp", date: "2026-12-09", time: "11:00" }), // the one just booked
    appt({ typeId: "vitc", date: "2026-12-09", time: "09:30" }),
    appt({ typeId: "laser", date: "2026-12-09", time: "14:00" }),
  ], nameOf);
  assert.deepEqual(
    items.map((i) => `${i.time} ${i.typeName}`),
    ["09:30 SUERO VITAMINA C", "11:00 TERAPIA PRP", "14:00 LASER"],
  );
});

test("sheetItems: the just-booked appointment is not printed twice (even when the BE row has no time)", () => {
  const items = sheetItems(result([booked("2026-12-09", "08:00", "TERAPIA PRP")]), [
    appt({ typeId: "prp", date: "2026-12-09", time: null }),
  ], nameOf);
  assert.equal(items.length, 1);
});

test("sheetItems: only the days on the sheet, only live ones, only this center", () => {
  const items = sheetItems(result([booked("2026-12-09", "11:00", "TERAPIA PRP")]), [
    appt({ typeId: "vitc", date: "2026-12-10", time: "09:00" }), // another day
    appt({ typeId: "vitc", date: "2026-12-09", time: "09:00", isLive: false }), // cancelled
    appt({ typeId: "laser", date: "2026-12-09", time: "10:00", centerId: "cag" }), // another center
  ], nameOf);
  assert.deepEqual(items.map((i) => i.typeName), ["TERAPIA PRP"]);
});

test("sheetItems: a medical appointment that day keeps its doctor; an unnamed type is left out", () => {
  const items = sheetItems(result([booked("2026-12-09", "11:00", "TERAPIA PRP")]), [
    appt({ kind: "medical", typeId: "cons", date: "2026-12-09T00:00:00.000Z", time: "08:30:00", withLabel: "Dr. Rivera" }),
    appt({ typeId: "unknown", date: "2026-12-09", time: "12:00" }),
  ], nameOf);
  assert.deepEqual(items[0], { date: "2026-12-09", time: "08:30", typeName: "CONSULTA NUEVA", kind: "medical", doctor: "Dr. Rivera" });
  assert.equal(items.length, 2);
});

test("sheetItems: a same-day appointment with no time goes last in its day", () => {
  const items = sheetItems(result([booked("2026-12-09", "11:00", "TERAPIA PRP"), booked("2026-12-10", "09:00", "TERAPIA PRP")]), [
    appt({ typeId: "laser", date: "2026-12-09", time: null }),
  ], nameOf);
  assert.deepEqual(items.map((i) => `${i.date} ${i.time || "-"} ${i.typeName}`), [
    "2026-12-09 11:00 TERAPIA PRP",
    "2026-12-09 - LASER",
    "2026-12-10 09:00 TERAPIA PRP",
  ]);
});

test("sheetItems: two sessions of the same service at different times are both kept", () => {
  const items = sheetItems(result([booked("2026-12-09", "11:00", "TERAPIA PRP")]), [
    appt({ typeId: "prp", date: "2026-12-09", time: "11:00" }),
    appt({ typeId: "prp", date: "2026-12-09", time: "16:00" }),
  ], nameOf);
  assert.deepEqual(items.map((i) => i.time), ["11:00", "16:00"]);
});
