import { test } from "node:test";
import assert from "node:assert/strict";

import { citaEditPayload, type CitaEditForm, type CitaEditOriginal } from "./cita-edit-payload.ts";

const original: CitaEditOriginal = {
  patientId: "p1",
  appointmentTypeId: "t1",
  doctorId: "d1",
  date: "2026-11-10T00:00:00.000Z",
  time: "09:00:00",
  endTime: "09:30:00",
  reason: "Dolor",
  notes: null,
};

const form = (over: Partial<CitaEditForm> = {}): CitaEditForm => ({
  patientId: "p1",
  appointmentTypeId: "t1",
  doctorId: "d1",
  date: "2026-11-10",
  time: "09:00",
  endTime: "09:30",
  reason: "Dolor",
  notes: "",
  ...over,
});

test("nothing changed → empty payload (never the create keys)", () => {
  assert.deepEqual(citaEditPayload(original, form()), { kind: "ok", payload: {} });
});

test("only the fields the update accepts, and only the changed ones", () => {
  const r = citaEditPayload(original, form({ time: "10:00", endTime: "10:30", notes: " llamar " }));
  assert.deepEqual(r, { kind: "ok", payload: { time: "10:00", endTime: "10:30", notes: "llamar" } });
  if (r.kind !== "ok") return;
  for (const k of ["patientId", "appointmentTypeId", "date", "channel", "isFirstVisit", "status"]) {
    assert.equal(k in r.payload, false, k);
  }
});

test("doctor changed / cleared; reason cleared travels as null", () => {
  assert.deepEqual(citaEditPayload(original, form({ doctorId: "d2" })), { kind: "ok", payload: { doctorId: "d2" } });
  assert.deepEqual(citaEditPayload(original, form({ doctorId: "", reason: "  " })), {
    kind: "ok",
    payload: { doctorId: null, reason: null },
  });
});

test("a new date, type or patient is locked (needs a reschedule)", () => {
  assert.deepEqual(citaEditPayload(original, form({ date: "2026-11-11", appointmentTypeId: "t2" })), {
    kind: "locked",
    fields: ["date", "appointmentType"],
  });
  assert.deepEqual(citaEditPayload(original, form({ patientId: "p2" })), { kind: "locked", fields: ["patient"] });
});
