import { test } from "node:test"
import assert from "node:assert/strict"

import {
  filterByServiceArrivedPending,
  groupByPatient,
  patientConcluded,
  pendingArrivals,
  serviceCancelledOnly,
  serviceConcluded,
  servicePending,
  servicesOfTheDay,
  type DayConsultation,
  type DaySession,
} from "./patient-day.ts"

// Task 10a (appointment lifecycle 5d): the patient desk reads stage groups, not old status words.
// Not served (stored as cancelled + an arrival stamp) is cancelled; a called therapy is waiting.
const services = [{ id: "s-laser", slug: "laser", name: "LÁSER", color: null }]
const AT = "2026-11-26T13:00:00Z"
const ses = (id: string, patientId: string, extra: Partial<DaySession> = {}): DaySession => ({
  id,
  patientId,
  serviceId: "s-laser",
  status: "pendiente",
  time: "09:00:00",
  patient: { id: patientId, name: patientId, medicalRecordNumber: patientId },
  ...extra,
})
const consult = (id: string, patientId: string, extra: Partial<DayConsultation> = {}): DayConsultation => ({
  id,
  pacienteId: patientId,
  paciente: patientId,
  estado: "confirmada",
  ...extra,
})

test("a not-served session is cancelled: dropped next to a live one, not arrived, its stamp does not make the patient present", () => {
  const [p] = groupByPatient(
    [
      ses("ns", "p1", { status: "cancelada", presentAt: AT }),
      ses("live", "p1", { status: "pendiente" }),
    ],
    [],
    services
  )
  assert.deepEqual(p.services[0].sessionIds, ["live"])
  assert.equal(p.presentAt, null)
  assert.equal(servicesOfTheDay([p])[0].arrived, 0)
  assert.equal(pendingArrivals(p), 1)
})

test("only not-served sessions: the service is cancelled-only and the day is all cancelled", () => {
  const [p] = groupByPatient([ses("ns", "p1", { status: "cancelada", presentAt: AT })], [], services)
  assert.equal(serviceCancelledOnly(p.services[0]), true)
  assert.equal(serviceConcluded(p.services[0]), false)
  assert.equal(servicePending(p.services[0]), false)
  assert.equal(p.allCancelled, true)
})

test("a called therapy is waiting: arrived, still owed a close, pending, not a pending arrival", () => {
  const list = groupByPatient([ses("c", "p1", { status: "presente", calledAt: AT, presentAt: AT })], [], services)
  assert.equal(servicesOfTheDay(list)[0].arrived, 1)
  assert.equal(servicesOfTheDay(list)[0].attended, 0)
  assert.deepEqual(filterByServiceArrivedPending(list, "s-laser").map((p) => p.patientId), ["p1"])
  assert.equal(servicePending(list[0].services[0]), true)
  assert.equal(pendingArrivals(list[0]), 0)
  assert.equal(patientConcluded(list[0]), false)
})

test("a session read by its stage columns alone (no old value): called is waiting, not served is cancelled, booked is upcoming", () => {
  const list = groupByPatient(
    [
      ses("w", "p1", { status: null, bookingStatus: "arrived", careStatus: "called" }),
      ses("n", "p2", { status: null, bookingStatus: "arrived", careStatus: "not_served", presentAt: AT }),
      ses("b", "p3", { status: null, bookingStatus: "booked", careStatus: null }),
      ses("d", "p4", { status: null, bookingStatus: "arrived", careStatus: "done" }),
    ],
    [],
    services
  )
  const by = new Map(list.map((p) => [p.patientId, p]))
  assert.deepEqual(filterByServiceArrivedPending(list, "s-laser").map((p) => p.patientId), ["p1"])
  assert.equal(by.get("p2")!.allCancelled, true)
  assert.equal(pendingArrivals(by.get("p3")!), 1)
  assert.equal(serviceConcluded(by.get("p4")!.services[0]), true)
  assert.deepEqual(servicesOfTheDay(list)[0], { serviceId: "s-laser", name: "LÁSER", color: null, arrived: 2, attended: 1 })
})

test("a stale session (old value moved on, stage columns not yet synced) is judged by its old value", () => {
  const [p] = groupByPatient(
    [ses("s", "p1", { status: "asistido", bookingStatus: "arrived", careStatus: "in_therapy", syncedStatus: "en_terapia" })],
    [],
    services
  )
  assert.equal(serviceConcluded(p.services[0]), true)
})

test("a not-served consultation (cancelada + arrival stamp) is cancelled: no arrival, the day is all cancelled", () => {
  const [p] = groupByPatient([], [consult("c", "p1", { estado: "cancelada", presente: AT })], services)
  assert.equal(p.allCancelled, true)
  assert.equal(p.presentAt, null)
  assert.equal(p.consultationPresentAt, null)
  assert.equal(pendingArrivals(p), 0)
  // Finished but never seen: a terminal not-served consultation alone does not conclude the day.
  assert.equal(patientConcluded(p, () => true), false)
})

test("a waiting consultation (presente) arrived; a confirmed one is still a pending arrival", () => {
  const [p] = groupByPatient(
    [],
    [consult("a", "p1", { estado: "presente", presente: AT }), consult("b", "p1", { estado: "confirmada" })],
    services
  )
  assert.equal(p.consultationPresentAt, AT)
  assert.equal(pendingArrivals(p), 1)
  assert.deepEqual(p.consultationGroups, ["waiting", "confirmed"])
})
