import { test } from "node:test"
import assert from "node:assert/strict"

import { flowStepIndex, sessionMenuOffered } from "./session-flow.ts"

// The flow steps a session row draws (board statuses with a homonymous transition), as the 6a and the 6b
// definitions serve them.
const FLOW_6A = [{ clave: "presente" }, { clave: "en_terapia" }, { clave: "asistido" }]
const FLOW_6B = [
  { clave: "presente", group: "waiting" },
  { clave: "en_terapia", group: "in_therapy" },
  { clave: "asistido", group: "done" },
]
const reactivar = { slug: "reactivar", fromStatuses: ["cancelada"], permissionSlug: "frontdesk.repair" }
const reactivar6b = { ...reactivar, fromGroups: ["cancelled_or_not_served"] }
const enTerapia = { slug: "en_terapia", fromStatuses: ["presente"], permissionSlug: null }
const canAll = () => true

for (const [shape, flow] of [["6a", FLOW_6A], ["6b", FLOW_6B]] as const) {
  test(`session flow (${shape}): a called session stands on the present step`, () => {
    assert.equal(flowStepIndex(flow, "waiting"), 0)
  })
  test(`session flow (${shape}): a not-served session stands on no step`, () => {
    assert.equal(flowStepIndex(flow, "cancelled_or_not_served"), -1)
    assert.equal(flowStepIndex(flow, null), -1)
  })
}

for (const [shape, tr] of [["6a", reactivar], ["6b", reactivar6b]] as const) {
  test(`session menu (${shape}, no list): Reactivar shows on a not-served session, by group and permission`, () => {
    assert.equal(sessionMenuOffered(tr, "cancelled_or_not_served", null, canAll), true)
    assert.equal(sessionMenuOffered(tr, "cancelled_or_not_served", null, () => false), false)
    assert.equal(sessionMenuOffered(tr, "waiting", null, canAll), false)
  })
}

test("session menu: the row's list wins over the group rule", () => {
  assert.equal(sessionMenuOffered(enTerapia, "waiting", ["uncall"], canAll), false)
  assert.equal(sessionMenuOffered(enTerapia, "upcoming", ["start_therapy"], canAll), true)
  // A called session, no list: start therapy starts from the waiting group.
  assert.equal(sessionMenuOffered(enTerapia, "waiting", null, canAll), true)
})
