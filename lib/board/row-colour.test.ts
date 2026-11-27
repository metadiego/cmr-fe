import { test } from "node:test"
import assert from "node:assert/strict"

import { estadoOfGroup, rowColour } from "./row-colour.ts"

// The lite statuses a board table gets (clave, orden, colour), as the 6a and the 6b definitions give them.
const MED_6A = [
  { clave: "presente", orden: 3, color: "#violet" },
  { clave: "en_consulta", orden: 5, color: "#blue" },
  { clave: "cancelada", orden: 8, color: "#red" },
]
const MED_6B = MED_6A.map((e) => ({ ...e, group: { presente: "waiting", en_consulta: "in_consultation", cancelada: "cancelled_or_not_served" }[e.clave] }))
const THE_6A = [
  { clave: "pendiente", orden: 1, color: "#grey" },
  { clave: "presente", orden: 2, color: "#violet" },
  { clave: "en_terapia", orden: 3, color: "#amber" },
]
const THE_6B = THE_6A.map((e) => ({ ...e, group: { pendiente: "upcoming", presente: "waiting", en_terapia: "in_therapy" }[e.clave] }))

for (const [shape, estados] of [["6a", MED_6A], ["6b", MED_6B]] as const) {
  test(`row colour (${shape}): a not-served row takes the cancelled status colour`, () => {
    assert.equal(rowColour("medical", estados, { estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" }), "#red")
  })
  test(`row colour (${shape}): stages that disagree with the old word are stale, the word decides`, () => {
    assert.equal(rowColour("medical", estados, { estado: "en_consulta", bookingStatus: "arrived", careStatus: "waiting" }), "#blue")
  })
}

for (const [shape, estados] of [["6a", THE_6A], ["6b", THE_6B]] as const) {
  test(`row colour (${shape}): a called therapy row takes the present colour`, () => {
    assert.equal(rowColour("therapy", estados, { estado: "presente", bookingStatus: "arrived", careStatus: "called" }), "#violet")
  })
}

test("row colour: no lifecycle kind matches the raw status; no status, no colour", () => {
  assert.equal(rowColour(null, [{ clave: "abierta", orden: 1, color: "#x" }], { estado: "abierta" }), "#x")
  assert.equal(rowColour("medical", MED_6B, {}), null)
})

test("estadoOfGroup: a flow step's target group finds its board status under both shapes", () => {
  assert.equal(estadoOfGroup("medical", MED_6A, "in_consultation")?.color, "#blue")
  assert.equal(estadoOfGroup("therapy", THE_6B, "waiting")?.color, "#violet")
  assert.equal(estadoOfGroup("therapy", THE_6B, null), undefined)
})
