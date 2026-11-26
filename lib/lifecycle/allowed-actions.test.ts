import { test } from "node:test"
import assert from "node:assert/strict"

import {
  appointmentMenu,
  appointmentMenuFor,
  confirmToggle,
  readAllowedActions,
  slugOffered,
} from "./allowed-actions.ts"
import { cancelMeaning, noShowAllowed } from "./board-action-rules.ts"

const AT = "2026-11-25T13:00:00Z"

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

test("cancel meaning comes from the list when the row carries one, whatever the stored status", () => {
  assert.equal(cancelMeaning("medical", { estado: "presente" }, ["confirm", "cancel"]), "cancel")
  assert.equal(cancelMeaning("medical", { estado: "programada" }, ["not_serve", "call"]), "not_serve")
  assert.equal(cancelMeaning("medical", { estado: "programada" }, ["finish"]), null)
  assert.equal(cancelMeaning("medical", { estado: "programada" }, []), null)
  // no list: the stage rule (piece 3) decides
  assert.equal(cancelMeaning("medical", { estado: "programada" }, null), "cancel")
  assert.equal(cancelMeaning("medical", { estado: "presente" }, undefined), "not_serve")
  assert.equal(cancelMeaning("medical", { estado: "en_consulta" }, null), null)
})

test("the confirm toggle offers confirm, unconfirm or nothing", () => {
  assert.equal(confirmToggle(["confirm", "check_in"]), "confirm")
  assert.equal(confirmToggle(["unconfirm", "check_in"]), "unconfirm")
  assert.equal(confirmToggle(["check_in"]), null)
  assert.equal(confirmToggle(null), null)
})

test("the list and the status rules agree on a row the backend has not moved", () => {
  // the same row seen by a backend with and without 4a: arrived and waiting = "not served"
  assert.equal(cancelMeaning("medical", { estado: "presente" }, ["not_serve", "start_triage"]), cancelMeaning("medical", { estado: "presente" }))
  // before arrival, today: both offer No-show (the list holds it; the status rule allows it)
  assert.ok(appointmentMenu(["no_show"]).includes("noShow"))
  assert.equal(noShowAllowed("medical", { estado: "confirmada" }, "2026-11-25", "2026-11-25"), true)
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

const TODAY = "2026-11-25"
const menu = (
  status: string,
  allowed: string[] | null,
  extra: { date?: string; canConfirm?: boolean; row?: Record<string, unknown> } = {},
) =>
  appointmentMenuFor({
    row: { estado: status, ...extra.row },
    date: extra.date ?? TODAY,
    today: TODAY,
    allowed,
    canConfirm: extra.canConfirm ?? true,
  })

test("menu without a list: the stage table, Confirm gated on the permission, No-show by date", () => {
  assert.deepEqual(menu("programada", null), ["confirmar", "reagendar", "noShow", "cancelar"])
  assert.deepEqual(menu("programada", null, { canConfirm: false }), ["reagendar", "noShow", "cancelar"])
  assert.deepEqual(menu("confirmada", null, { date: "2026-11-30" }), ["presente", "reagendar", "cancelar"])
  assert.deepEqual(menu("presente", null), ["cancelar"])
  assert.deepEqual(menu("en_consulta", null), [])
  assert.deepEqual(menu("atendida", null), [])
})

test("menu with a list: the list decides, not the stored status, the date or the flat permission", () => {
  assert.deepEqual(menu("en_consulta", ["cancel"]), ["cancelar"])
  assert.deepEqual(menu("programada", ["confirm", "no_show"], { date: "2026-11-30", canConfirm: false }), ["confirmar", "noShow"])
  assert.deepEqual(menu("programada", []), [])
})

test("menu without a list reads the stage group: not served offers nothing, stage columns alone count", () => {
  assert.deepEqual(menu("cancelada", null, { row: { arrivedAt: AT } }), [])
  assert.deepEqual(menu("triage", null), ["cancelar"])
  assert.deepEqual(menu("", null, { row: { bookingStatus: "confirmed" } }), ["presente", "reagendar", "noShow", "cancelar"])
  assert.deepEqual(menu("", null, { row: { bookingStatus: "arrived", careStatus: "waiting" } }), ["cancelar"])
  assert.deepEqual(menu("algo_nuevo", null), [])
})
