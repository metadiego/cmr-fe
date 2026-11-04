import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fromCita,
  fromSesion,
  splitUpcomingPast,
  type PatientAppointment,
} from "./patient-appointments.ts";
import type { Cita } from "../../api/citas.ts";
import type { Sesion } from "../../api/frontdesk.ts";

function cita(over: Record<string, unknown>): Cita {
  return {
    id: "c1",
    appointmentTypeId: "t1",
    date: "2026-11-10",
    time: "9:00",
    status: "programada",
    doctorName: "Dra. Paz",
    ...over,
  } as unknown as Cita;
}
function sesion(over: Record<string, unknown>): Sesion {
  return {
    id: "s1",
    serviceId: "sv1",
    date: "2026-11-10",
    time: "09:30:00",
    status: "pendiente",
    ...over,
  } as unknown as Sesion;
}
function item(over: Partial<PatientAppointment>): PatientAppointment {
  return {
    id: "x",
    kind: "medical",
    typeId: "t",
    date: "2026-11-10",
    time: "09:00",
    status: "programada",
    withLabel: null,
    isLive: true,
    ...over,
  };
}

test("fromCita normalises time and maps the doctor", () => {
  const a = fromCita(cita({}));
  assert.equal(a.kind, "medical");
  assert.equal(a.typeId, "t1");
  assert.equal(a.time, "09:00");
  assert.equal(a.withLabel, "Dra. Paz");
  assert.equal(a.isLive, true);
  assert.equal(fromCita(cita({ status: "atendida", doctorName: undefined })).withLabel, null);
  assert.equal(fromCita(cita({ status: "atendida" })).isLive, false);
});

test("fromSesion maps service, normalises time, no invented label", () => {
  const a = fromSesion(sesion({}));
  assert.equal(a.kind, "service");
  assert.equal(a.typeId, "sv1");
  assert.equal(a.time, "09:30");
  assert.equal(a.withLabel, null);
  assert.equal(a.isLive, true);
  assert.equal(fromSesion(sesion({ status: "asistido", time: null })).time, null);
  assert.equal(fromSesion(sesion({ status: "cancelada" })).isLive, false);
});

test("upcoming interleaves medical and service by date and time", () => {
  const { upcoming } = splitUpcomingPast(
    [
      item({ id: "a", date: "2026-11-12", time: "08:00" }),
      item({ id: "b", kind: "service", date: "2026-11-10", time: "10:00" }),
      item({ id: "c", date: "2026-11-10", time: "09:00" }),
    ],
    "2026-11-04",
  );
  assert.deepEqual(upcoming.map((i) => i.id), ["c", "b", "a"]);
});

test("a cancelled future item goes to past", () => {
  const { upcoming, past } = splitUpcomingPast(
    [item({ id: "a", date: "2026-11-12", status: "cancelada", isLive: false })],
    "2026-11-04",
  );
  assert.equal(upcoming.length, 0);
  assert.deepEqual(past.map((i) => i.id), ["a"]);
});

test("reprogramada is dropped everywhere", () => {
  const r = splitUpcomingPast(
    [
      item({ id: "a", date: "2026-11-12", status: "reprogramada", isLive: false }),
      item({ id: "b", date: "2026-10-01", status: "reprogramada", isLive: false }),
    ],
    "2026-11-04",
  );
  assert.equal(r.upcoming.length + r.past.length, 0);
});

test("past is capped at 5 and newest first", () => {
  const items = Array.from({ length: 8 }, (_, i) =>
    item({ id: `p${i}`, date: `2026-10-0${i + 1}`, status: "atendida", isLive: false }),
  );
  const { past } = splitUpcomingPast(items, "2026-11-04");
  assert.deepEqual(past.map((i) => i.id), ["p7", "p6", "p5", "p4", "p3"]);
});

test("null time sorts after timed items on the same day", () => {
  const { upcoming } = splitUpcomingPast(
    [item({ id: "n", time: null }), item({ id: "t", time: "15:00" })],
    "2026-11-04",
  );
  assert.deepEqual(upcoming.map((i) => i.id), ["t", "n"]);
});

test("a live item today is upcoming; a live item in the past goes to past", () => {
  const { upcoming, past } = splitUpcomingPast(
    [item({ id: "today", date: "2026-11-04" }), item({ id: "old", date: "2026-11-01" })],
    "2026-11-04",
  );
  assert.deepEqual(upcoming.map((i) => i.id), ["today"]);
  assert.deepEqual(past.map((i) => i.id), ["old"]);
});
