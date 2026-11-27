import { test } from "node:test"
import assert from "node:assert/strict"

import { statusSelect } from "./status-select.ts"

// citas_cc: the call center's board, two statuses; its transitions between them (production rows).
const CC_6A = [{ slug: "programada" }, { slug: "confirmada" }]
const CC_6B = [{ slug: "programada", group: "booked" }, { slug: "confirmada", group: "confirmed" }]
const TR_6A = [
  { slug: "confirmar", fromStatuses: ["programada"], toStatus: "confirmada" },
  { slug: "volver_programada", fromStatuses: ["confirmada"], toStatus: "programada" },
]
const TR_6B = [
  { ...TR_6A[0], fromGroups: ["booked"], toGroup: "confirmed" },
  { ...TR_6A[1], fromGroups: ["confirmed"], toGroup: "booked" },
]

for (const [shape, statuses, transitions] of [["6a", CC_6A, TR_6A], ["6b", CC_6B, TR_6B]] as const) {
  test(`status select (${shape}): a booked row picks Confirmar to reach confirmed`, () => {
    const v = statusSelect("medical", statuses, transitions, { estado: "programada", bookingStatus: "booked" }, null)
    assert.equal(v.current?.slug, "programada")
    assert.equal(v.transitionTo(statuses[1])?.slug, "confirmar")
    assert.equal(v.transitionTo(statuses[0]), undefined) // already there
  })

  test(`status select (${shape}): a not-served row is locked, labelled not served (not "Cancelada")`, () => {
    const v = statusSelect("medical", statuses, transitions, { estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" }, null)
    assert.equal(v.current, undefined)
    assert.equal(v.label, "not_served")
  })
}

test("status select: the row's allowedActions can refuse the move", () => {
  const row = { estado: "confirmada", bookingStatus: "confirmed" } as const
  assert.equal(statusSelect("medical", CC_6B, TR_6B, row, ["unconfirm"]).transitionTo(CC_6B[0])?.slug, "volver_programada")
  assert.equal(statusSelect("medical", CC_6B, TR_6B, row, ["cancel"]).transitionTo(CC_6B[0]), undefined)
})

test("status select: a called therapy session sits in the present status", () => {
  const statuses = [{ slug: "pendiente" }, { slug: "presente", group: "waiting" }]
  const transitions = [{ slug: "volver_pendiente", fromStatuses: ["presente"], toStatus: "pendiente" }]
  const v = statusSelect("therapy", statuses, transitions, { estado: "presente", bookingStatus: "arrived", careStatus: "called" }, null)
  assert.equal(v.current?.slug, "presente")
  assert.equal(v.label, "waiting")
  assert.equal(v.transitionTo(statuses[0])?.slug, "volver_pendiente")
})

test("status select: a row with no status has no label", () => {
  assert.equal(statusSelect("medical", CC_6B, TR_6B, {}, null).label, null)
})
