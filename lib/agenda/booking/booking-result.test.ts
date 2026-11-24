import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingResult,
  resultCenter,
  resultPatient,
  serviceBookingResult,
  trainBookingResult,
  type BookingResultItem,
} from "./booking-result.ts";

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

test("resultPatient: display name and record; no record stays null", () => {
  assert.deepEqual(resultPatient({ firstName: "Ana", lastName: "Ruiz", medicalRecordNumber: "77" }), {
    name: "Ana Ruiz",
    record: "77",
  });
  assert.deepEqual(resultPatient({ firstName: "Ana", lastName: null, displayName: "Ana R." }), {
    name: "Ana R.",
    record: null,
  });
});

test("resultCenter: name, phone and address; missing ones are null, an unknown center is blank", () => {
  assert.deepEqual(resultCenter({ name: "CMR Caguas", phone: "787-000-0000" }), {
    name: "CMR Caguas",
    phone: "787-000-0000",
    address: null,
  });
  assert.deepEqual(resultCenter(undefined), { name: "", phone: null, address: null });
});

test("serviceBookingResult: service items with HH:MM times, sorted, skipped and warnings kept", () => {
  const r = serviceBookingResult({
    patient: { name: "Ana" },
    center: { name: "CMR Caguas" },
    serviceName: "Laser",
    created: [
      { date: "2026-12-08", time: "10:00:00" },
      { date: "2026-12-01", time: "09:30" },
    ],
    skipped: [{ date: "2026-12-15", reason: "already has it" }],
    warnings: ["over capacity"],
  });
  assert.equal(r.mode, "booked");
  assert.deepEqual(r.items, [
    { date: "2026-12-01", time: "09:30", typeName: "Laser", kind: "service" },
    { date: "2026-12-08", time: "10:00", typeName: "Laser", kind: "service" },
  ]);
  assert.deepEqual(r.skipped, [{ date: "2026-12-15", reason: "already has it" }]);
  assert.deepEqual(r.warnings, ["over capacity"]);
});

test("buildBookingResult: the same warning (or skipped date + reason) twice is listed once", () => {
  const r = buildBookingResult({
    mode: "booked",
    patient: { name: "Ana" },
    center: { name: "C" },
    items: [],
    skipped: [
      { date: "2026-12-01", reason: "lleno" },
      { date: "2026-12-01", reason: "lleno" },
    ],
    warnings: ["Cupo lleno", "Revisar pago", "Cupo lleno"],
  });
  assert.deepEqual(r.warnings, ["Cupo lleno", "Revisar pago"]);
  assert.deepEqual(r.skipped, [{ date: "2026-12-01", reason: "lleno" }]);
});

const trainBase = {
  patient: { name: "RIVERA SOTO, ANA", record: "10482" },
  center: { name: "CMR Bayamon", phone: null, address: null },
  serviceName: (id: string) => ({ laser: "Láser", emtt: "EMTT" })[id] ?? id,
  fallbackTime: () => "10:00",
  warnings: [] as string[],
};

test("trainBookingResult lists one row per leg in time order", () => {
  const r = trainBookingResult({
    ...trainBase,
    sessions: [
      { serviceId: "emtt", date: "2026-11-24", time: "09:10" },
      { serviceId: "laser", date: "2026-11-24", time: "09:00:00" },
    ],
  });
  assert.equal(r.mode, "booked");
  assert.deepEqual(r.items, [
    { date: "2026-11-24", time: "09:00", typeName: "Láser", kind: "service" },
    { date: "2026-11-24", time: "09:10", typeName: "EMTT", kind: "service" },
  ]);
  assert.deepEqual(r.skipped, []);
});

test("trainBookingResult uses the day's entry time when a session has none", () => {
  const r = trainBookingResult({ ...trainBase, sessions: [{ serviceId: "laser", date: "2026-11-25T00:00:00", time: null }] });
  assert.deepEqual(r.items, [{ date: "2026-11-25", time: "10:00", typeName: "Láser", kind: "service" }]);
});

test("trainBookingResult lists a repeated warning once", () => {
  const r = trainBookingResult({
    ...trainBase,
    sessions: [{ serviceId: "laser", date: "2026-11-24", time: "09:00" }],
    warnings: ["Lleno", "Lleno"],
  });
  assert.deepEqual(r.warnings, ["Lleno"]);
});
