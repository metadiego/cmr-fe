import { test } from "node:test"
import assert from "node:assert/strict"

import { kpiChips } from "./kpi-chips.ts"

// Board statuses as the 6a backend serves them (old words only) and as the 6b one does (plus the group).
const s6a = (slug: string, sortOrder: number) => ({ slug, sortOrder, labelKey: `x.${slug}`, color: "#000" })
const MEDICAL_6A = ["confirmada", "presente", "en_consulta", "atendida", "cancelada"].map((slug, i) => s6a(slug, i + 1))
const GROUPS: Record<string, string> = {
  confirmada: "confirmed",
  presente: "waiting",
  en_consulta: "in_consultation",
  atendida: "done",
  cancelada: "cancelled_or_not_served",
  pendiente: "upcoming",
  en_terapia: "in_therapy",
  asistido: "done",
}
const MEDICAL_6B = MEDICAL_6A.map((s) => ({ ...s, group: GROUPS[s.slug] }))
const THERAPY_6A = ["pendiente", "presente", "en_terapia", "asistido", "cancelada"].map((slug, i) => s6a(slug, i + 1))
const THERAPY_6B = THERAPY_6A.map((s) => ({ ...s, group: GROUPS[s.slug] }))

const rows = [
  { id: "1", estado: "presente", bookingStatus: "arrived", careStatus: "waiting" },
  { id: "2", estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" },
  { id: "3", estado: "cancelada", bookingStatus: "cancelled", careStatus: null },
  { id: "4", estado: "en_consulta", bookingStatus: "arrived", careStatus: "in_consultation" },
]

for (const [shape, statuses] of [["6a", MEDICAL_6A], ["6b", MEDICAL_6B]] as const) {
  test(`kpi chips (${shape}): a not-served row counts in the cancelled chip and filters with it`, () => {
    const k = kpiChips("medical", statuses, rows, "cancelada")
    assert.equal(k.counts.get("cancelada"), 2)
    assert.deepEqual(k.chips.map((s) => s.slug), ["presente", "en_consulta", "cancelada"])
    assert.deepEqual(k.filtered.map((r) => r.id), ["2", "3"])
  })
}

for (const [shape, statuses] of [["6a", THERAPY_6A], ["6b", THERAPY_6B]] as const) {
  test(`kpi chips (${shape}): a called therapy row counts as present`, () => {
    const called = [{ id: "c", estado: "presente", bookingStatus: "arrived", careStatus: "called" }]
    const k = kpiChips("therapy", statuses, called, "presente")
    assert.equal(k.counts.get("presente"), 1)
    assert.deepEqual(k.filtered.map((r) => r.id), ["c"])
  })
}

test("kpi chips: the selected chip shows even with no rows; no selection keeps every row", () => {
  const k = kpiChips("medical", MEDICAL_6B, rows, "atendida")
  assert.ok(k.chips.some((s) => s.slug === "atendida"))
  assert.equal(k.filtered.length, 0)
  assert.equal(kpiChips("medical", MEDICAL_6B, rows, "").filtered.length, 4)
})

test("kpi chips: a board of another entity counts by the row's raw status", () => {
  const k = kpiChips(null, [{ slug: "abierta" }], [{ id: "x", estado: "abierta" }], "")
  assert.equal(k.counts.get("abierta"), 1)
})
