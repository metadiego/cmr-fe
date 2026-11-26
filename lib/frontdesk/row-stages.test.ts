import { test } from "node:test"
import assert from "node:assert/strict"

import { consultationRowStaged, groupIn, rowGroup, sessionRowStaged } from "./row-stages.ts"

const AT = "2026-11-26T13:00:00Z"

test("rowGroup: a therapy row's group, by its stages or derived from its old value; null when unknown", () => {
  assert.equal(rowGroup("therapy", { status: "presente", calledAt: AT }), "waiting")
  assert.equal(rowGroup("therapy", { status: "cancelada", presentAt: AT }), "cancelled_or_not_served")
  assert.equal(rowGroup("therapy", { bookingStatus: "arrived", careStatus: "called" }), "waiting")
  assert.equal(rowGroup("therapy", { status: "otro" }), null)
  assert.equal(rowGroup("medical", { estado: "en_consulta" }), "in_consultation")
})

test("groupIn: a null group is in no list", () => {
  assert.equal(groupIn("waiting", ["waiting", "in_therapy"]), true)
  assert.equal(groupIn("done", ["waiting"]), false)
  assert.equal(groupIn(null, ["waiting"]), false)
})

test("sessionRowStaged: the board row's status, with the session's stages only while they were synced from it", () => {
  const session = { bookingStatus: "arrived", careStatus: "called", syncedStatus: "presente", calledAt: AT } as const
  assert.equal(rowGroup("therapy", sessionRowStaged("presente", session)), "waiting")
  // The board row moved on (SSE) and the session map lags: the row's status wins.
  assert.equal(rowGroup("therapy", sessionRowStaged("asistido", session)), "done")
  // A not-served session: cancelled + arrival stamp.
  assert.equal(
    rowGroup("therapy", sessionRowStaged("cancelada", { bookingStatus: "arrived", careStatus: "not_served", syncedStatus: "cancelada", presentAt: AT })),
    "cancelled_or_not_served",
  )
  assert.equal(rowGroup("therapy", sessionRowStaged("pendiente", null)), "upcoming")
  assert.equal(rowGroup("therapy", sessionRowStaged("", undefined)), null)
})

test("consultationRowStaged: a consultation board row (estado + presente stamp)", () => {
  assert.equal(rowGroup("medical", consultationRowStaged({ estado: "presente", presente: AT })), "waiting")
  assert.equal(rowGroup("medical", consultationRowStaged({ estado: "cancelada", presente: AT })), "cancelled_or_not_served")
  assert.equal(rowGroup("medical", consultationRowStaged({ estado: "confirmada" })), "confirmed")
  assert.equal(rowGroup("medical", consultationRowStaged({})), null)
})
