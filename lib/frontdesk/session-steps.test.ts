import { test } from "node:test"
import assert from "node:assert/strict"

import { hiddenStepSlugs, sessionSteps } from "./session-steps.ts"
import { terminalChecker } from "../lifecycle/board-catalogue.ts"
import { consultationPending, groupByPatient } from "./patient-day.ts"

const OLD = ["pendiente", "presente", "en_terapia", "asistido", "cancelada"]
const GROUPS = ["upcoming", "waiting", "in_therapy", "done", "cancelled_or_not_served"]
const STATUSES_6A = OLD.map((slug) => ({ slug }))
const STATUSES_6B = OLD.map((slug, i) => ({ slug, group: GROUPS[i] }))

const TR_6A = [
  { slug: "presente", fromStatuses: ["pendiente"], toStatus: "presente" },
  { slug: "en_terapia", fromStatuses: ["presente"], toStatus: "en_terapia" },
  { slug: "asistido", fromStatuses: ["en_terapia"], toStatus: "asistido" },
  { slug: "cancelar", fromStatuses: [], toStatus: "cancelada" },
]
const TR_6B = [
  { ...TR_6A[0], fromGroups: ["upcoming"], toGroup: "waiting" },
  { ...TR_6A[1], fromGroups: ["waiting"], toGroup: "in_therapy" },
  { ...TR_6A[2], fromGroups: ["in_therapy"], toGroup: "done" },
  { ...TR_6A[3], fromGroups: [], toGroup: "cancelled_or_not_served" },
]

test("sessionSteps: the three stamped steps, in board order, under both shapes", () => {
  const want = ["presente", "en_terapia", "asistido"]
  assert.deepEqual(sessionSteps(STATUSES_6A, TR_6A).map((s) => s.slug), want)
  assert.deepEqual(sessionSteps(STATUSES_6B, TR_6B).map((s) => s.slug), want)
})

test("sessionSteps: a status no transition leads into is not a step (cancelled and upcoming never are)", () => {
  assert.deepEqual(sessionSteps(STATUSES_6A, TR_6A.slice(0, 2)).map((s) => s.slug), ["presente", "en_terapia"])
  assert.deepEqual(sessionSteps(STATUSES_6B, []).map((s) => s.slug), [])
})

test("hiddenStepSlugs: only the arrival step is hidden, under both shapes", () => {
  assert.deepEqual([...hiddenStepSlugs(sessionSteps(STATUSES_6A, TR_6A))], ["presente"])
  assert.deepEqual([...hiddenStepSlugs(sessionSteps(STATUSES_6B, TR_6B))], ["presente"])
})

test("terminalChecker: flagged statuses are final by group, under both shapes; a row without group uses its word", () => {
  const flag = (xs: { slug: string; group?: string }[]) =>
    xs.map((s) => ({ ...s, isTerminal: s.slug === "atendida" || s.slug === "cancelada" }))
  const med = ["programada", "presente", "atendida", "cancelada"]
  const a = terminalChecker("medical", flag(med.map((slug) => ({ slug }))))
  const b = terminalChecker("medical", flag([
    { slug: "programada", group: "booked" },
    { slug: "presente", group: "waiting" },
    { slug: "atendida", group: "done" },
    { slug: "cancelada", group: "cancelled_or_not_served" },
  ]))
  for (const f of [a, b]) {
    assert.equal(f("atendida", "done"), true)
    assert.equal(f("presente", "waiting"), false)
    // A not-served row (old word cancelada) is in the cancelled group: final.
    assert.equal(f("cancelada", "cancelled_or_not_served"), true)
    assert.equal(f("atendida", null), true)
    assert.equal(f("presente"), false)
  }
})

test("consultationPending: a consultation is final by its group (a not-served one included)", () => {
  const isFinal = terminalChecker("medical", [
    { slug: "atendida", group: "done", isTerminal: true },
    { slug: "cancelada", group: "cancelled_or_not_served", isTerminal: true },
    { slug: "presente", group: "waiting", isTerminal: false },
  ])
  const day = (estado: string, extra: Record<string, unknown> = {}) =>
    groupByPatient([], [{ id: "c", pacienteId: "p1", estado, ...extra } as never], [])[0]
  assert.equal(consultationPending(day("atendida"), isFinal), false)
  assert.equal(consultationPending(day("presente"), isFinal), true)
  assert.equal(consultationPending(day("cancelada", { presente: "2026-11-02T10:00:00Z" }), isFinal), false)
})
