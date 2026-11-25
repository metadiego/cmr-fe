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
const today = "2026-11-25"

test("without allowedActions: today's rule (status, permission, active)", () => {
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, today, allowed: null, can: (p) => p !== "appointments.confirm" })
  assert.deepEqual(out.map((t) => t.slug), ["presente", "recordatorio", "cancelar"])
})

test("with allowedActions: the lifecycle moves come from the list, not from status or permission", () => {
  // stored status says programada, but the list (the backend) says only check-in and cancel today
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, today, allowed: ["check_in", "cancel"], can: () => false })
  assert.deepEqual(out.map((t) => t.slug), ["presente", "recordatorio", "cancelar"])
})

test("with allowedActions: a move the list leaves out is hidden", () => {
  const out = availableTransitions(transitions, { status: "confirmada", isTerminal: false, today, allowed: ["confirm"], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["confirmar", "recordatorio"])
})

test("cancel on an arrived row is relabelled not-served", () => {
  const out = availableTransitions(transitions, { status: "presente", isTerminal: false, today, allowed: ["not_serve"], can: canAll })
  const cancel = out.find((t) => t.slug === "cancelar")
  assert.equal(cancel?.labelKey, "lifecycle.action.not_serve")
})

test("an empty list hides every lifecycle move; a board's own transition keeps its rule", () => {
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, today, allowed: [], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["recordatorio"])
})

test("without allowedActions: piece-3 rules hide Cancel in consultation and relabel it on arrival", () => {
  const ts = [tr("cancelar", ["presente", "en_consulta"])]
  const arrived = availableTransitions(ts, { status: "presente", isTerminal: false, today, allowed: null, can: canAll })
  assert.equal(arrived[0]?.labelKey, "lifecycle.action.not_serve")
  const inConsult = availableTransitions(ts, { status: "en_consulta", isTerminal: false, today, allowed: null, can: canAll })
  assert.deepEqual(inConsult, [])
})

test("without allowedActions: No-show hidden on a future day and after arrival", () => {
  const ts = [tr("no_show", ["confirmada", "presente"])]
  const run = (status: string, date: string) =>
    availableTransitions(ts, { status, isTerminal: false, today, date, allowed: null, can: canAll }).map((t) => t.slug)
  assert.deepEqual(run("confirmada", today), ["no_show"])
  assert.deepEqual(run("confirmada", "2026-12-01"), [])
  assert.deepEqual(run("presente", today), [])
})

test("with allowedActions: the list wins over the piece-3 rules (No-show listed on a future day stays)", () => {
  const ts = [tr("no_show", ["confirmada"])]
  const out = availableTransitions(ts, { status: "confirmada", isTerminal: false, today, date: "2026-12-01", allowed: ["no_show"], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["no_show"])
})
