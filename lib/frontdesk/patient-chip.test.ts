import { test } from "node:test"
import assert from "node:assert/strict"

import { chipStatus } from "./patient-chip.ts"
import { groupByPatient, type DayConsultation, type DaySession } from "./patient-day.ts"

const MED_6A = [{ slug: "presente", color: "#violet" }, { slug: "cancelada", color: "#red" }]
const MED_6B = MED_6A.map((s) => ({ ...s, group: s.slug === "presente" ? "waiting" : "cancelled_or_not_served" }))
const THE_6A = [{ slug: "pendiente", color: "#grey" }, { slug: "presente", color: "#violet" }]
const THE_6B = THE_6A.map((s) => ({ ...s, group: s.slug === "presente" ? "waiting" : "upcoming" }))

for (const [shape, statuses] of [["6a", MED_6A], ["6b", MED_6B]] as const) {
  test(`patient chip (${shape}): a not-served consultation reads 'not served' in the cancelled colour`, () => {
    const c = chipStatus("medical", statuses, "cancelled_or_not_served", "not_served")
    assert.deepEqual(c, { labelKey: "lifecycle.label.medical.not_served", color: "#red" })
  })
}

for (const [shape, statuses] of [["6a", THE_6A], ["6b", THE_6B]] as const) {
  test(`patient chip (${shape}): a called session reads 'present' in the present colour`, () => {
    assert.deepEqual(chipStatus("therapy", statuses, "waiting", "waiting"), { labelKey: "lifecycle.label.therapy.waiting", color: "#violet" })
  })
}

test("patient chip: no stage, no label and no colour", () => {
  assert.deepEqual(chipStatus("therapy", THE_6B, null, null), { labelKey: null, color: null })
})

test("groupByPatient keeps each row's stage label next to its group (not served told apart)", () => {
  const sessions: DaySession[] = [
    { id: "s1", patientId: "p", serviceId: "laser", status: "presente", bookingStatus: "arrived", careStatus: "called" },
  ]
  const consultations = [
    { id: "c1", pacienteId: "p", estado: "cancelada", presente: "2026-11-26T13:00:00Z" },
  ] as unknown as DayConsultation[]
  const [p] = groupByPatient(sessions, consultations, [{ id: "laser" } as never])
  assert.deepEqual(p.services[0].labels, ["waiting"])
  assert.deepEqual(p.consultationLabels, ["not_served"])
})
