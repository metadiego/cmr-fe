import { test } from "node:test";
import assert from "node:assert/strict";

import { rankCandidates, readUnlinked, valueEntries, type LinkCandidate } from "./unlinked.ts";

test("readUnlinked: the v2 English keys give record and «Last, First»", () => {
  const r = readUnlinked({
    kind: "tape",
    id: "m1",
    clinicId: "c1",
    clinicName: "CMR Caguas",
    date: "2026-11-07",
    values: { waist: 91.5, hip: "102" },
    patient: { id: "p1", medicalRecordNumber: "15808", firstName: "Ana", lastName: "Rivera" },
  });
  assert.equal(r.kind, "tape");
  assert.deepEqual(r.patient, { id: "p1", record: "15808", name: "Rivera, Ana" });
  assert.deepEqual(r.values, { waist: 91.5, hip: 102 }, "numeric strings become numbers");
});

test("readUnlinked: the v1 Spanish keys still read, and a null patient stays null", () => {
  const r = readUnlinked({ kind: "scale", id: "m2", clinicId: "c1", date: "2026-11-07", values: {}, patient: { id: "p2", record: "R1", nombres: "Luis", apellidos: "Soto" } });
  assert.deepEqual(r.patient, { id: "p2", record: "R1", name: "Soto, Luis" });
  const none = readUnlinked({ kind: "scale", id: "m3", clinicId: "c1", date: "2026-11-07", values: { weightKg: 80, note: "x" }, patient: null });
  assert.equal(none.patient, null);
  assert.deepEqual(none.values, { weightKg: 80 }, "non-numeric values are dropped");
});

test("valueEntries: the key values first, the rest after in their order", () => {
  const e = valueEntries({ kind: "scale", values: { boneMassKg: 3, bmi: 27, weightKg: 81 } });
  assert.deepEqual(e.map(([k]) => k), ["weightKg", "bmi", "boneMassKg"]);
});

const c = (id: string, over: Partial<LinkCandidate>): LinkCandidate => ({
  id, patientId: null, patientName: null, record: null, serviceName: null, time: null, status: "pendiente", ...over,
});

test("rankCandidates: own patient first, then GLP-1, then time; cancelled out", () => {
  const list = [
    c("a", { patientId: "x", serviceName: "Láser", time: "08:00" }),
    c("b", { patientId: "p1", serviceName: "Láser", time: "10:00" }),
    c("c", { patientId: "y", serviceName: "GLP-1", time: "09:00" }),
    c("d", { patientId: "p1", serviceName: "GLP-1", time: "11:00", status: "cancelada" }),
  ];
  assert.deepEqual(rankCandidates(list, { patientId: "p1" }).map((x) => x.id), ["b", "c", "a"]);
});

test("rankCandidates: the search matches name, record or service, without accents", () => {
  const list = [c("a", { patientName: "PÉREZ ÁLAMO, MAGDA", record: "15001" }), c("b", { patientName: "SOTO, LUIS", record: "16041" })];
  assert.deepEqual(rankCandidates(list, { query: "perez" }).map((x) => x.id), ["a"]);
  assert.deepEqual(rankCandidates(list, { query: "16041" }).map((x) => x.id), ["b"]);
});
