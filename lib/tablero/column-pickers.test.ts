import { test } from "node:test"
import assert from "node:assert/strict"

import { doorSlugOptions, requiredStageOptions } from "./column-pickers.ts"

const OLD = ["programada", "confirmada", "presente", "triage", "en_consulta", "atendida", "no_show", "cancelada", "reprogramada"]
const GROUPS = ["booked", "confirmed", "waiting", "triage", "in_consultation", "done", "no_show", "cancelled_or_not_served", "rescheduled"]
const STATUSES_6A = OLD.map((slug) => ({ slug }))
const STATUSES_6B = OLD.map((slug, i) => ({ slug, group: GROUPS[i] }))

test("requiredStageOptions: the same options from either definition shape, storing old words", () => {
  const a = requiredStageOptions("medical", STATUSES_6A)
  const b = requiredStageOptions("medical", STATUSES_6B)
  assert.deepEqual(a, b)
  assert.deepEqual(a.map((o) => o.value), OLD)
  assert.equal(a[2].labelKey, "lifecycle.label.medical.waiting")
  assert.equal(a[7].labelKey, "lifecycle.label.medical.cancelled")
})

test("requiredStageOptions: one option per group, unknown statuses left out, therapy kind", () => {
  const out = requiredStageOptions("therapy", [
    { slug: "pendiente", group: "upcoming" },
    { slug: "en_terapia" },
    { slug: "mystery" },
    { slug: "otra_espera", group: "waiting" },
    { slug: "presente", group: "waiting" },
  ])
  assert.deepEqual(out.map((o) => o.value), ["pendiente", "en_terapia", "otra_espera"])
  assert.equal(out[1].labelKey, "lifecycle.label.therapy.in_therapy")
})

test("doorSlugOptions: door slugs once each, from either transition shape", () => {
  const a = doorSlugOptions([
    { slug: "presente", fromStatuses: ["programada"], toStatus: "presente" },
    { slug: "cancelar", fromStatuses: [], toStatus: "cancelada" },
    { slug: "presente", fromStatuses: ["confirmada"], toStatus: "presente" },
  ])
  const b = doorSlugOptions([
    { slug: "presente", fromGroups: ["booked"], toGroup: "waiting" },
    { slug: "cancelar", fromGroups: [], toGroup: "cancelled_or_not_served" },
  ])
  assert.deepEqual(a, b)
  assert.deepEqual(a.map((o) => o.value), ["presente", "cancelar"])
})
