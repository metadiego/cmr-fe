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

test("without allowedActions: today's rule (status, permission, active)", () => {
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, allowed: null, can: (p) => p !== "appointments.confirm" })
  assert.deepEqual(out.map((t) => t.slug), ["presente", "recordatorio", "cancelar"])
})

test("with allowedActions: the lifecycle moves come from the list, not from status or permission", () => {
  // stored status says programada, but the list (the backend) says only check-in and cancel today
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, allowed: ["check_in", "cancel"], can: () => false })
  assert.deepEqual(out.map((t) => t.slug), ["presente", "recordatorio", "cancelar"])
})

test("with allowedActions: a move the list leaves out is hidden", () => {
  const out = availableTransitions(transitions, { status: "confirmada", isTerminal: false, allowed: ["confirm"], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["confirmar", "recordatorio"])
})

test("cancel on an arrived row is relabelled not-served", () => {
  const out = availableTransitions(transitions, { status: "presente", isTerminal: false, allowed: ["not_serve"], can: canAll })
  const cancel = out.find((t) => t.slug === "cancelar")
  assert.equal(cancel?.labelKey, "lifecycle.action.not_serve")
})

test("an empty list hides every lifecycle move; a board's own transition keeps its rule", () => {
  const out = availableTransitions(transitions, { status: "programada", isTerminal: false, allowed: [], can: canAll })
  assert.deepEqual(out.map((t) => t.slug), ["recordatorio"])
})
