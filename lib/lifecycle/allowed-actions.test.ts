import { test } from "node:test"
import assert from "node:assert/strict"

import {
  appointmentMenu,
  cancelMeaning,
  confirmToggle,
  readAllowedActions,
  refusalRefreshesRow,
  slugOffered,
} from "./allowed-actions.ts"

test("a row without the list (backend before 4a, or a board that does not send it) reads as null", () => {
  assert.equal(readAllowedActions({ id: "r1" }), null)
  assert.equal(readAllowedActions(null), null)
  assert.equal(readAllowedActions({ allowedActions: "confirm" }), null)
})

test("a row with the list reads it, empty included", () => {
  assert.deepEqual(readAllowedActions({ allowedActions: ["confirm", "cancel"] }), ["confirm", "cancel"])
  assert.deepEqual(readAllowedActions({ allowedActions: [] }), [])
  assert.deepEqual(readAllowedActions({ allowedActions: ["confirm", 3, null] }), ["confirm"])
})

test("without a list the old rule decides (null)", () => {
  assert.equal(slugOffered("presente", null), null)
  assert.equal(slugOffered("cancelar", undefined), null)
})

test("a lifecycle slug is offered only when one of its actions is listed", () => {
  assert.equal(slugOffered("presente", ["check_in"]), true)
  assert.equal(slugOffered("presente", ["confirm"]), false)
  assert.equal(slugOffered("confirmar", ["confirm"]), true)
  assert.equal(slugOffered("volver_programada", ["unconfirm"]), true)
  // the same slug names a medical or a therapy action: the row's list only holds its own kind's keys
  assert.equal(slugOffered("consulta", ["start_consultation"]), true)
  assert.equal(slugOffered("consulta", ["start_therapy"]), true)
  assert.equal(slugOffered("asistido", ["finish"]), true)
  assert.equal(slugOffered("desasistir", ["unattend"]), true)
  assert.equal(slugOffered("desatender", ["undo_attendance"]), true)
  assert.equal(slugOffered("volver_pendiente", ["undo_check_in"]), true)
  assert.equal(slugOffered("reactivar", ["reactivate"]), true)
  assert.equal(slugOffered("reagendar", ["reschedule"]), true)
  assert.equal(slugOffered("no_show", []), false)
})

test("cancel is offered as a plain cancel or as not-served", () => {
  assert.equal(slugOffered("cancelar", ["cancel"]), true)
  assert.equal(slugOffered("cancelar", ["not_serve"]), true)
  assert.equal(slugOffered("cancelar", ["finish"]), false)
})

test("an action key sent as a slug is checked as itself", () => {
  assert.equal(slugOffered("check_in", ["check_in"]), true)
  assert.equal(slugOffered("start_triage", ["check_in"]), false)
})

test("a slug outside the lifecycle stays with the board's own rule (null)", () => {
  assert.equal(slugOffered("enviar_recordatorio", ["confirm"]), null)
})

test("cancel meaning comes from the list", () => {
  assert.equal(cancelMeaning(["confirm", "cancel"]), "cancel")
  assert.equal(cancelMeaning(["not_serve", "call"]), "not_serve")
  assert.equal(cancelMeaning(["finish"]), null)
  assert.equal(cancelMeaning(null), undefined)
})

test("the confirm toggle offers confirm, unconfirm or nothing", () => {
  assert.equal(confirmToggle(["confirm", "check_in"]), "confirm")
  assert.equal(confirmToggle(["unconfirm", "check_in"]), "unconfirm")
  assert.equal(confirmToggle(["check_in"]), null)
  assert.equal(confirmToggle(null), null)
})

test("a stale or no-longer-allowed refusal refreshes the row; other errors do not", () => {
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_ACTION_NOT_ALLOWED" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_STALE" }), true)
  assert.equal(refusalRefreshesRow({ code: "LIFECYCLE_REASON_REQUIRED" }), false)
  assert.equal(refusalRefreshesRow(new Error("x")), false)
  assert.equal(refusalRefreshesRow(null), false)
})

test("the appointment menu (CitaActions) is drawn from the list, in its own order", () => {
  assert.deepEqual(appointmentMenu(["confirm", "check_in", "no_show", "cancel", "reschedule"]), [
    "confirmar",
    "presente",
    "reagendar",
    "noShow",
    "cancelar",
  ])
  assert.deepEqual(appointmentMenu(["unconfirm", "check_in"]), ["unconfirm", "presente"])
  assert.deepEqual(appointmentMenu(["not_serve", "start_triage"]), ["cancelar"])
  assert.deepEqual(appointmentMenu([]), [])
})
