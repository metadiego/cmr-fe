import { test } from "node:test"
import assert from "node:assert/strict"

import {
  boardActionView,
  cancelAllOffered,
  cancelMeaning,
  cancelMeaningFromList,
  noShowAllowed,
  NOT_SERVE_LABEL_KEY,
  refusalRefreshesRow,
} from "./board-action-rules.ts"

const TODAY = "2026-11-25"
const AT = "2026-11-25T13:00:00Z"
const med = (estado: string, extra: Record<string, unknown> = {}) => ({ estado, ...extra })
const ses = (status: string, extra: Record<string, unknown> = {}) => ({ status, ...extra })

test("cancel before arrival is a plain cancel, for both kinds", () => {
  for (const s of ["programada", "confirmada"]) assert.equal(cancelMeaning("medical", med(s)), "cancel", s)
  assert.equal(cancelMeaning("therapy", ses("pendiente")), "cancel")
  assert.equal(cancelMeaning("therapy", ses("pendiente", { confirmedAt: AT })), "cancel")
})

test("cancel on an arrived, waiting row means not served (called and triage included)", () => {
  for (const s of ["presente", "triage"]) assert.equal(cancelMeaning("medical", med(s)), "not_serve", s)
  assert.equal(cancelMeaning("therapy", ses("presente")), "not_serve")
  assert.equal(cancelMeaning("therapy", ses("presente", { calledAt: AT })), "not_serve")
})

test("cancel is refused in consultation, in therapy, done or already closed (not served included)", () => {
  for (const s of ["en_consulta", "atendida", "cancelada", "no_show", "reprogramada"])
    assert.equal(cancelMeaning("medical", med(s)), null, s)
  for (const s of ["en_terapia", "asistido", "cancelada"]) assert.equal(cancelMeaning("therapy", ses(s)), null, s)
  assert.equal(cancelMeaning("medical", med("cancelada", { arrivedAt: AT })), null)
  assert.equal(cancelMeaning("therapy", ses("cancelada", { presentAt: AT })), null)
})

test("the fallback reads the row's synced stages, not its old value", () => {
  // Stage columns alone (no old value): arrived + called is waiting, so Cancel means not served.
  assert.equal(cancelMeaning("therapy", { bookingStatus: "arrived", careStatus: "called" }), "not_serve")
  assert.equal(cancelMeaning("medical", { bookingStatus: "arrived", careStatus: "not_served" }), null)
  // Stale stage columns (synced from another status) lose to the old value.
  assert.equal(
    cancelMeaning("medical", { estado: "programada", bookingStatus: "arrived", careStatus: "waiting", syncedStatus: "presente" }),
    "cancel",
  )
})

test("an unknown status keeps the plain cancel: the backend decides", () => {
  assert.equal(cancelMeaning("medical", med("")), "cancel")
  assert.equal(cancelMeaning("therapy", ses("algo_nuevo")), "cancel")
})

test("the row's list decides when it carries one", () => {
  assert.equal(cancelMeaningFromList(["not_serve", "call"]), "not_serve")
  assert.equal(cancelMeaningFromList(["confirm", "cancel"]), "cancel")
  assert.equal(cancelMeaningFromList(["finish"]), null)
  assert.equal(cancelMeaningFromList([]), null)
  assert.equal(cancelMeaning("medical", med("presente"), ["confirm", "cancel"]), "cancel")
  assert.equal(cancelMeaning("medical", med("programada"), []), null)
})

test("no-show only before arrival (medical), today or in the past", () => {
  assert.equal(noShowAllowed("medical", med("programada"), TODAY, TODAY), true)
  assert.equal(noShowAllowed("medical", med("confirmada"), "2026-11-20", TODAY), true)
  assert.equal(noShowAllowed("medical", med("confirmada"), "2026-11-26", TODAY), false)
  for (const s of ["presente", "triage", "en_consulta", "atendida", "cancelada", "no_show"])
    assert.equal(noShowAllowed("medical", med(s), TODAY, TODAY), false, s)
  assert.equal(noShowAllowed("medical", med("cancelada", { arrivedAt: AT }), TODAY, TODAY), false)
  // Therapy has no no-show: a booked session never offers it.
  for (const s of ["pendiente", "presente", "cancelada"]) assert.equal(noShowAllowed("therapy", ses(s), TODAY, TODAY), false, s)
  assert.equal(noShowAllowed("therapy", ses("presente", { calledAt: AT }), TODAY, TODAY), false)
})

test("no-show without a known date is left to the backend", () => {
  assert.equal(noShowAllowed("medical", med("programada"), undefined, TODAY), true)
})

test("board view: cancel is relabelled on an arrived row and hidden in consultation", () => {
  assert.deepEqual(boardActionView("cancelar", "x.cancel", "medical", med("confirmada"), TODAY, TODAY), { visible: true, labelKey: "x.cancel" })
  assert.deepEqual(boardActionView("cancelar", "x.cancel", "medical", med("presente"), TODAY, TODAY), { visible: true, labelKey: NOT_SERVE_LABEL_KEY })
  assert.deepEqual(boardActionView("cancelar", "x.cancel", "therapy", ses("presente", { calledAt: AT }), TODAY, TODAY), { visible: true, labelKey: NOT_SERVE_LABEL_KEY })
  assert.equal(boardActionView("cancelar", "x.cancel", "medical", med("en_consulta"), TODAY, TODAY).visible, false)
  assert.equal(boardActionView("cancelar", "x.cancel", "therapy", ses("cancelada", { presentAt: AT }), TODAY, TODAY).visible, false)
})

test("board view: no-show hidden after arrival and on a future day; other slugs untouched", () => {
  assert.equal(boardActionView("no_show", "x.ns", "medical", med("presente"), TODAY, TODAY).visible, false)
  assert.equal(boardActionView("no_show", "x.ns", "medical", med("confirmada"), "2026-12-01", TODAY).visible, false)
  assert.deepEqual(boardActionView("atender", "x.at", "medical", med("en_consulta"), TODAY, TODAY), { visible: true, labelKey: "x.at" })
})

test("a stale or no-longer-allowed refusal refreshes the row; other errors do not", () => {
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_ACTION_NOT_ALLOWED" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_STALE" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_REASON_REQUIRED" }), false)
  assert.equal(refusalRefreshesRow(new Error("x")), false)
  assert.equal(refusalRefreshesRow(null), false)
})

test("Cancel all is offered only on a row whose own session can still be cancelled", () => {
  // Booked or arrived and waiting: the patient's day can still be cancelled from this row.
  assert.equal(cancelAllOffered(cancelMeaning("therapy", ses("pendiente")), false), true)
  assert.equal(cancelAllOffered(cancelMeaning("therapy", ses("presente")), false), true)
  assert.equal(cancelAllOffered(cancelMeaningFromList(["not_serve", "start_therapy"]), false), true)
  // Therapy started (in therapy or attended): no cancel of any kind on this row.
  assert.equal(cancelAllOffered(cancelMeaningFromList(["finish", "back_to_waiting"]), false), false)
  assert.equal(cancelAllOffered(cancelMeaningFromList(["unattend", "undo_attendance"]), false), false)
  // Already cancelled.
  assert.equal(cancelAllOffered("cancel", true), false)
})
