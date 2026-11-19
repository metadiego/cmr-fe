import { test } from "node:test"
import assert from "node:assert/strict"

import {
  filterByServiceArrivedPending,
  groupByPatient,
  servicesOfTheDay,
  type DaySession,
} from "./patient-day.ts"

// N=presente/N=asistidos per service (owner, 06-nov-2026): split off patient-day.test.ts, which
// was at its line ceiling (same pattern as patient-day-arrival.test.ts).
const services = [{ id: "s-laser", slug: "laser", name: "LÁSER", color: "#ea580c" }]
const ses = (
  id: string,
  patientId: string,
  serviceId: string,
  extra: Partial<DaySession> = {}
): DaySession => ({
  id,
  patientId,
  serviceId,
  status: "pendiente",
  time: "09:00:00",
  patient: { id: patientId, name: patientId, medicalRecordNumber: patientId },
  ...extra,
})

test("servicesOfTheDay: arrived counts anyone past 'pendiente'; attended only 'asistido'; cancelled sessions don't count either way", () => {
  const list = groupByPatient(
    [
      ses("a", "p1", "s-laser", { status: "asistido" }),
      ses("b", "p2", "s-laser", { status: "presente" }),
      ses("c", "p3", "s-laser", { status: "pendiente" }),
      ses("d", "p4", "s-laser", { status: "cancelada" }),
    ],
    [],
    services
  )
  const laser = servicesOfTheDay(list).find((s) => s.serviceId === "s-laser")!
  assert.equal(laser.arrived, 2) // asistido + presente — not pendiente, not cancelada
  assert.equal(laser.attended, 1) // only asistido
})

test("filterByServiceArrivedPending: only patients who showed up for that service but aren't 'asistido' yet", () => {
  const list = groupByPatient(
    [
      ses("a", "p1", "s-laser", { status: "en_terapia" }),
      ses("b", "p2", "s-laser", { status: "asistido" }),
      ses("c", "p3", "s-laser", { status: "pendiente" }),
    ],
    [],
    services
  )
  assert.deepEqual(
    filterByServiceArrivedPending(list, "s-laser").map((p) => p.patientId),
    ["p1"]
  )
})
