import { test } from "node:test"
import assert from "node:assert/strict"

import { rowGroup } from "../lifecycle/stage-groups.ts"
import { consultationRowStaged, sessionRowStaged } from "./row-stages.ts"

const AT = "2026-11-26T13:00:00Z"

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
