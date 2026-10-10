import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPatients, groupByPatient, type DaySession } from "./patient-day.ts";

const services = [
  { id: "s-apex", slug: "apex", name: "APEX", color: "#1d4ed8" },
  { id: "s-laser", slug: "laser", name: "LÁSER", color: "#ea580c" },
];
const ses = (id: string, patientId: string, serviceId: string, extra: Partial<DaySession> = {}): DaySession => ({
  id,
  patientId,
  serviceId,
  status: "pendiente",
  time: "09:00:00",
  patient: { id: patientId, name: patientId === "p1" ? "RAMOS HUECA, LILLIAM" : "VALENTÍN, MARÍA", medicalRecordNumber: patientId === "p1" ? "12345" : "102796" },
  ...extra,
});

test("one entry per patient with every service they have today, in the configured service order", () => {
  const out = groupByPatient(
    [ses("a", "p1", "s-laser"), ses("b", "p1", "s-apex"), ses("c", "p1", "s-laser", { time: "10:00:00" })],
    [],
    services,
  );
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].services.map((s) => [s.slug, s.sessionIds]), [["apex", ["b"]], ["laser", ["a", "c"]]]);
  assert.equal(out[0].earliestTime, "09:00");
  assert.equal(out[0].record, "12345");
});

test("consultations join the same patient (Spanish keys of the consultation board)", () => {
  const out = groupByPatient([ses("a", "p1", "s-apex")], [{ id: "c1", pacienteId: "p1", paciente: "RAMOS HUECA, LILLIAM", record: "12345", estado: "atendida" }], services);
  assert.deepEqual(out[0].consultationIds, ["c1"]);
  assert.deepEqual(out[0].consultationStatuses, ["atendida"]);
});

test("a patient with only a consultation still shows up", () => {
  const out = groupByPatient([], [{ id: "c1", pacienteId: "p9", paciente: "PADILLA, LUIS", record: "92720", estado: "pendiente" }], services);
  assert.equal(out[0].name, "PADILLA, LUIS");
  assert.equal(out[0].services.length, 0);
});

test("order: arrived first (by arrival), then earliest booking, cancelled-only days last", () => {
  const out = groupByPatient(
    [
      ses("a", "p1", "s-apex", { time: "08:00:00" }),
      ses("b", "p2", "s-apex", { time: "11:00:00", presentAt: "2026-10-09T13:05:00Z" }),
      ses("c", "p3", "s-apex", { time: "07:00:00", status: "cancelada", patient: { name: "ZZ", medicalRecordNumber: "1" } }),
    ],
    [],
    services,
  );
  assert.deepEqual(out.map((p) => p.patientId), ["p2", "p1", "p3"]);
});

test("search ignores accents and case, and also finds by record or service", () => {
  const out = groupByPatient([ses("a", "p1", "s-apex"), ses("b", "p2", "s-laser")], [], services);
  assert.deepEqual(filterPatients(out, "valentin").map((p) => p.patientId), ["p2"]);
  assert.deepEqual(filterPatients(out, "12345").map((p) => p.patientId), ["p1"]);
  assert.deepEqual(filterPatients(out, "laser").map((p) => p.patientId), ["p2"]);
  assert.equal(filterPatients(out, "  ").length, 2);
});
