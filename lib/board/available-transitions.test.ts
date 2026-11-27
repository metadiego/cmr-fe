import { test } from "node:test"
import assert from "node:assert/strict"

import { availableTransitions, type TransitionLite } from "./available-transitions.ts"

function tr(slug: string, fromStatuses: string[], extra: Partial<TransitionLite> = {}): TransitionLite {
  return { slug, labelKey: `x.${slug}`, fromStatuses, permissionSlug: null, sortOrder: 0, active: true, ...extra }
}

const transitions = [
  tr("confirmar", ["programada"], { permissionSlug: "appointments.confirm", sortOrder: 1 }),
  tr("presente", ["programada", "confirmada"], { sortOrder: 2 }),
  tr("cancelar", ["programada", "confirmada", "presente"], { sortOrder: 9 }),
  tr("recordatorio", [], { sortOrder: 5 }),
  tr("apagada", [], { active: false }),
]
const canAll = () => true

// Piece 6b: the menu is drawn from the row's `allowedActions` only; the old status rule is gone. The
// backend stamps the list on every board row since piece 4 (cmr-be stamp-allowed-actions.ts).

test("without allowedActions: no lifecycle move is offered (the status rule is gone); a board's own one keeps its permission", () => {
  const out = availableTransitions(transitions, { allowed: null, can: (p) => p !== "appointments.confirm" })
  assert.deepEqual(out.map((t) => t.slug), ["recordatorio"])
})

test("with allowedActions: the lifecycle moves come from the list, not from status or permission", () => {
  const out = availableTransitions(transitions, { allowed: ["check_in", "cancel"], can: () => false })
  assert.deepEqual(out.map((t) => t.slug), ["presente", "recordatorio", "cancelar"])
})

test("with allowedActions: a move the list leaves out is hidden", () => {
  const out = availableTransitions(transitions, { allowed: ["confirm"], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["confirmar", "recordatorio"])
})

test("cancel on an arrived row is relabelled not-served", () => {
  const out = availableTransitions(transitions, { allowed: ["not_serve"], can: canAll })
  const cancel = out.find((t) => t.slug === "cancelar")
  assert.equal(cancel?.labelKey, "lifecycle.action.not_serve")
})

test("an empty list hides every lifecycle move; a board's own transition keeps its permission rule", () => {
  assert.deepEqual(availableTransitions(transitions, { allowed: [], can: canAll }).map((t) => t.slug), ["recordatorio"])
  const guarded = [tr("recordatorio", [], { permissionSlug: "board.remind" })]
  assert.deepEqual(availableTransitions(guarded, { allowed: [], can: () => false }), [])
})

test("a not-served row: only what the list offers, whatever the transition's fromStatuses say", () => {
  const ts = [tr("cancelar", ["presente", "en_consulta"]), tr("reactivar", ["cancelada"]), tr("presente", ["confirmada"])]
  assert.deepEqual(availableTransitions(ts, { allowed: ["reactivate"], can: canAll }).map((t) => t.slug), ["reactivar"])
  assert.deepEqual(availableTransitions(ts, { allowed: [], can: canAll }), [])
})

test("No-show follows the list: listed on a future day stays, left out today is hidden", () => {
  const ts = [tr("no_show", ["confirmada"])]
  assert.deepEqual(availableTransitions(ts, { allowed: ["no_show"], can: canAll }).map((t) => t.slug), ["no_show"])
  assert.deepEqual(availableTransitions(ts, { allowed: ["cancel"], can: canAll }), [])
})

test("a called therapy session: start therapy and not-served cancel, no undo of the check-in", () => {
  const ts = [
    tr("en_terapia", ["presente"], { sortOrder: 2 }),
    tr("cancelar", ["pendiente", "presente"], { sortOrder: 9 }),
    tr("volver_pendiente", ["presente"], { sortOrder: 4 }),
  ]
  const out = availableTransitions(ts, { allowed: ["start_therapy", "not_serve", "uncall"], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["en_terapia", "cancelar"])
  assert.equal(out[1]?.labelKey, "lifecycle.action.not_serve")
})

test("inactive transitions never show, listed or not", () => {
  const ts = [tr("presente", [], { active: false })]
  assert.deepEqual(availableTransitions(ts, { allowed: ["check_in"], can: canAll }), [])
})
