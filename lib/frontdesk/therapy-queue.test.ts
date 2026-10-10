import { test } from "node:test"
import assert from "node:assert/strict"
import { earliestFreeWaitByPatient, queueEntryDisplayName, queueEntryRecord, queuePhase, turnsByPatient } from "./therapy-queue.ts"
import type { FrontdeskQueue } from "@/lib/api/frontdesk-queue"

// Forma verificada por HTTP contra prod 10-oct-2026 (GET /frontdesk/queue): `patientName` plano +
// `medicalRecordNumber` suelto, más `patient` anidado con el nombre "Apellidos, Nombre".
const queue: FrontdeskQueue = {
  date: "2026-10-10",
  totals: { waiting: 2, inTherapy: 1 },
  services: [
    {
      serviceId: "s-laser",
      key: "laser",
      name: "Láser",
      color: "#ea580c",
      icon: null,
      free: [{ staffId: "t1", name: "Luis", load: 0 }],
      skillsConfigured: true,
      waiting: [
        { sessionId: "sa", patientId: "p1", patientName: "A UNO", medicalRecordNumber: "1", patient: { id: "p1", medicalRecordNumber: "1", name: "UNO, A" }, turn: 1, arrivedAt: "2026-10-10T09:00:00Z", waitMinutes: 20, busyIn: null },
        // p2 está "ocupado en" otra terapia: tiene su puesto en Láser pero no está libre.
        { sessionId: "sb", patientId: "p2", patientName: "B DOS", medicalRecordNumber: "2", patient: { id: "p2", medicalRecordNumber: "2", name: "DOS, B" }, turn: 2, arrivedAt: "2026-10-10T09:05:00Z", waitMinutes: 15, busyIn: "s-apex" },
      ],
      inTherapy: [],
    },
    {
      serviceId: "s-apex",
      key: "apex",
      name: "APEX",
      color: "#1d4ed8",
      icon: null,
      free: [],
      skillsConfigured: true,
      waiting: [],
      inTherapy: [
        { sessionId: "sc", patientId: "p2", patientName: "B DOS", medicalRecordNumber: "2", technicianId: "t1", technicianName: "Luis", since: "2026-10-10T09:05:00Z", minutes: 10 },
      ],
    },
  ],
}

test("turnsByPatient: one entry per (patient, service) they are waiting in", () => {
  const map = turnsByPatient(queue)
  assert.equal(map.get("p1")?.length, 1)
  assert.equal(map.get("p1")?.[0].serviceId, "s-laser")
  assert.equal(map.get("p1")?.[0].turn, 1)
  assert.equal(map.get("p2")?.[0].busyIn, "s-apex")
  assert.equal(map.get("p3"), undefined)
})

test("earliestFreeWaitByPatient: ignores busyIn slots — p2 is not free anywhere", () => {
  const map = earliestFreeWaitByPatient(queue)
  assert.equal(map.get("p1"), "2026-10-10T09:00:00Z")
  assert.equal(map.get("p2"), undefined)
})

test("earliestFreeWaitByPatient: keeps the OLDEST free arrival across several pending therapies", () => {
  const twoWaits: FrontdeskQueue = {
    date: "2026-10-10",
    totals: { waiting: 1, inTherapy: 0 },
    services: [
      { serviceId: "s-laser", key: "laser", name: "Láser", color: null, icon: null, inTherapy: [], free: [], skillsConfigured: true,
        waiting: [{ sessionId: "sa", patientId: "p1", patientName: "A UNO", medicalRecordNumber: "1", turn: 1, arrivedAt: "2026-10-10T09:10:00Z", waitMinutes: 10, busyIn: null }] },
      { serviceId: "s-apex", key: "apex", name: "APEX", color: null, icon: null, inTherapy: [], free: [], skillsConfigured: true,
        waiting: [{ sessionId: "sb", patientId: "p1", patientName: "A UNO", medicalRecordNumber: "1", turn: 1, arrivedAt: "2026-10-10T09:00:00Z", waitMinutes: 20, busyIn: null }] },
    ],
  }
  assert.equal(earliestFreeWaitByPatient(twoWaits).get("p1"), "2026-10-10T09:00:00Z")
})

test("queuePhase: in therapy anywhere wins over waiting free elsewhere", () => {
  assert.equal(queuePhase("p2", queue), "inTherapy")
})

test("queuePhase: waiting free, not in therapy anywhere", () => {
  assert.equal(queuePhase("p1", queue), "waiting")
})

test("queueEntryDisplayName/Record: prefers the nested `patient` (confirmed shape for waiting)", () => {
  const w = queue.services[0].waiting[0]
  assert.equal(queueEntryDisplayName(w), "UNO, A")
  assert.equal(queueEntryRecord(w), "1")
})

test("queueEntryDisplayName/Record: falls back to the flat fields when `patient` is absent (inTherapy, unconfirmed)", () => {
  const e = queue.services[1].inTherapy[0]
  assert.equal(queueEntryDisplayName(e), "B DOS")
  assert.equal(queueEntryRecord(e), "2")
})

test("queuePhase: not in the queue at all today", () => {
  assert.equal(queuePhase("p3", queue), null)
})
