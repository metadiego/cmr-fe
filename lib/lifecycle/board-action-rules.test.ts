import { test } from "node:test"
import assert from "node:assert/strict"

import { boardActionView, cancelMeaning, noShowAllowed, NOT_SERVE_LABEL_KEY, refusalRefreshesRow } from "./board-action-rules.ts"

const TODAY = "2026-11-25"

test("cancel before arrival is a plain cancel, for both kinds", () => {
  for (const s of ["programada", "confirmada", "pendiente"]) assert.equal(cancelMeaning(s), "cancel", s)
})

test("cancel on an arrived, waiting row means not served (called and triage included)", () => {
  for (const s of ["presente", "triage"]) assert.equal(cancelMeaning(s), "not_serve", s)
})

test("cancel is refused in consultation, in therapy, done or already closed", () => {
  for (const s of ["en_consulta", "atendida", "en_terapia", "asistido", "cancelada", "no_show", "reprogramada"])
    assert.equal(cancelMeaning(s), null, s)
})

test("an unknown status keeps the plain cancel: the backend decides", () => {
  assert.equal(cancelMeaning(""), "cancel")
  assert.equal(cancelMeaning("algo_nuevo"), "cancel")
})

test("no-show only before arrival, today or in the past", () => {
  assert.equal(noShowAllowed("programada", TODAY, TODAY), true)
  assert.equal(noShowAllowed("confirmada", "2026-11-20", TODAY), true)
  assert.equal(noShowAllowed("confirmada", "2026-11-26", TODAY), false)
  for (const s of ["presente", "triage", "en_consulta", "atendida", "cancelada", "no_show"])
    assert.equal(noShowAllowed(s, TODAY, TODAY), false, s)
})

test("no-show without a known date is left to the backend", () => {
  assert.equal(noShowAllowed("programada", undefined, TODAY), true)
})

test("board view: cancel is relabelled on an arrived row and hidden in consultation", () => {
  assert.deepEqual(boardActionView("cancelar", "x.cancel", "confirmada", TODAY, TODAY), { visible: true, labelKey: "x.cancel" })
  assert.deepEqual(boardActionView("cancelar", "x.cancel", "presente", TODAY, TODAY), { visible: true, labelKey: NOT_SERVE_LABEL_KEY })
  assert.equal(boardActionView("cancelar", "x.cancel", "en_consulta", TODAY, TODAY).visible, false)
})

test("board view: no-show hidden after arrival and on a future day; other slugs untouched", () => {
  assert.equal(boardActionView("no_show", "x.ns", "presente", TODAY, TODAY).visible, false)
  assert.equal(boardActionView("no_show", "x.ns", "confirmada", "2026-12-01", TODAY).visible, false)
  assert.deepEqual(boardActionView("atender", "x.at", "en_consulta", TODAY, TODAY), { visible: true, labelKey: "x.at" })
})

test("a stale or no-longer-allowed refusal refreshes the row; other errors do not", () => {
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_ACTION_NOT_ALLOWED" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_STALE" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_REASON_REQUIRED" }), false)
  assert.equal(refusalRefreshesRow(new Error("x")), false)
  assert.equal(refusalRefreshesRow(null), false)
})
