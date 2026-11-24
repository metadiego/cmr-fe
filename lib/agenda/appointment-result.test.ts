import { test } from "node:test";
import assert from "node:assert/strict";

import { appointmentResult } from "./appointment-result.ts";

const base = {
  saved: { date: "2026-12-03T00:00:00.000Z", time: "10:00:00" },
  typeName: "Seguimiento",
  doctor: "Dr. Soto",
  patient: { name: "Ana", record: "77" },
  center: { name: "CMR Caguas", phone: null, address: null },
  warnings: ["Cupo lleno"],
};

test("appointmentResult: a new appointment is one booked medical item (day and HH:MM)", () => {
  const r = appointmentResult({ ...base, moved: false });
  assert.equal(r.mode, "booked");
  assert.deepEqual(r.items, [
    { date: "2026-12-03", time: "10:00", typeName: "Seguimiento", kind: "medical", doctor: "Dr. Soto" },
  ]);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.warnings, ["Cupo lleno"]);
  assert.deepEqual(r.patient, { name: "Ana", record: "77" });
});

test("appointmentResult: the BE moved the live one: mode moved, from = the old date and time", () => {
  const r = appointmentResult({ ...base, moved: true, from: { date: "2026-11-30", time: "08:30:00" } });
  assert.equal(r.mode, "moved");
  assert.deepEqual(r.items[0].from, { date: "2026-11-30", time: "08:30" });
});

test("appointmentResult: moved but the old one could not be read: moved, no from", () => {
  const r = appointmentResult({ ...base, moved: true, from: null });
  assert.equal(r.mode, "moved");
  assert.equal(r.items[0].from, undefined);
});

test("appointmentResult: no doctor stays null", () => {
  const r = appointmentResult({ ...base, doctor: null, moved: false });
  assert.equal(r.items[0].doctor, null);
});

test("appointmentResult: names the SAVED type (the BE may flip first visit / follow-up), else the asked one", () => {
  const types = [
    { id: "t-new", name: "Nueva" },
    { id: "t-fu", name: "Seguimiento" },
  ];
  const flipped = appointmentResult({ ...base, typeName: "Nueva", savedTypeId: "t-fu", types, moved: false });
  assert.equal(flipped.items[0].typeName, "Seguimiento");
  const unknown = appointmentResult({ ...base, typeName: "Nueva", savedTypeId: "t-gone", types, moved: false });
  assert.equal(unknown.items[0].typeName, "Nueva");
  const none = appointmentResult({ ...base, typeName: "Nueva", savedTypeId: null, types, moved: false });
  assert.equal(none.items[0].typeName, "Nueva");
});

test("appointmentResult: an old appointment with a date but no time still shows the old date", () => {
  const r = appointmentResult({ ...base, moved: true, from: { date: "2026-11-30T00:00:00.000Z", time: null } });
  assert.deepEqual(r.items[0].from, { date: "2026-11-30" });
});
