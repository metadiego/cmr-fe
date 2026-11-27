import { test } from "node:test"
import assert from "node:assert/strict"

import {
  boardKind,
  flowRank,
  oldWordGroup,
  rowReach,
  rowStatus,
  statusGroup,
  storedStatus,
  transitionFromGroups,
  transitionStartsFrom,
  transitionToGroup,
} from "./board-catalogue.ts"

// The two shapes the definition arrives in: the 6a backend (old words only) and the 6b one (old words
// plus the stage group of each).
const MEDICAL_6A = ["programada", "confirmada", "presente", "triage", "en_consulta", "atendida", "no_show", "cancelada", "reprogramada"].map(
  (slug) => ({ slug }),
)
const MEDICAL_6B = [
  { slug: "programada", group: "booked" },
  { slug: "confirmada", group: "confirmed" },
  { slug: "presente", group: "waiting" },
  { slug: "triage", group: "triage" },
  { slug: "en_consulta", group: "in_consultation" },
  { slug: "atendida", group: "done" },
  { slug: "no_show", group: "no_show" },
  { slug: "cancelada", group: "cancelled_or_not_served" },
  { slug: "reprogramada", group: "rescheduled" },
]
const THERAPY_6A = ["pendiente", "presente", "en_terapia", "asistido", "cancelada"].map((slug) => ({ slug }))
const THERAPY_6B = [
  { slug: "pendiente", group: "upcoming" },
  { slug: "presente", group: "waiting" },
  { slug: "en_terapia", group: "in_therapy" },
  { slug: "asistido", group: "done" },
  { slug: "cancelada", group: "cancelled_or_not_served" },
]

const notServed = { estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" } as const
const called = { estado: "presente", bookingStatus: "arrived", careStatus: "called" } as const

test("boardKind: cita boards are medical, sesion boards therapy, anything else none", () => {
  assert.equal(boardKind("cita"), "medical")
  assert.equal(boardKind("sesion"), "therapy")
  assert.equal(boardKind("factura"), null)
  assert.equal(boardKind(undefined), null)
})

test("statusGroup: the served group wins; without it the old slug is mapped (both shapes agree)", () => {
  assert.deepEqual(MEDICAL_6A.map((s) => statusGroup("medical", s)), MEDICAL_6B.map((s) => s.group))
  assert.deepEqual(THERAPY_6A.map((s) => statusGroup("therapy", s)), THERAPY_6B.map((s) => s.group))
  // A group of the other kind is ignored, the slug decides.
  assert.equal(statusGroup("therapy", { slug: "pendiente", group: "booked" }), "upcoming")
})

test("rowStatus: a not-served row sits in the board's cancelled status, under both shapes", () => {
  assert.equal(rowStatus("medical", MEDICAL_6A, notServed)?.slug, "cancelada")
  assert.equal(rowStatus("medical", MEDICAL_6B, notServed)?.slug, "cancelada")
  assert.equal(rowStatus("therapy", THERAPY_6B, { ...notServed, status: "cancelada" })?.slug, "cancelada")
})

test("rowStatus: a called therapy row sits in the waiting status, under both shapes", () => {
  assert.equal(rowStatus("therapy", THERAPY_6A, called)?.slug, "presente")
  assert.equal(rowStatus("therapy", THERAPY_6B, called)?.slug, "presente")
})

test("rowStatus: stored stages that disagree with the old word are stale; the old word decides", () => {
  // No syncedStatus on a board row: columns of another group than its word are not trusted (6b review).
  const row = { estado: "presente", bookingStatus: "arrived", careStatus: "in_consultation" } as const
  assert.equal(rowStatus("medical", MEDICAL_6B, row)?.slug, "presente")
  // A row with no status at all is in none.
  assert.equal(rowStatus("medical", MEDICAL_6B, {}), undefined)
})

test("transition groups: fromGroups/toGroup when served, else mapped from the old words", () => {
  const a = { slug: "en_terapia", fromStatuses: ["presente"], toStatus: "en_terapia" }
  const b = { ...a, fromGroups: ["waiting"], toGroup: "in_therapy" }
  assert.deepEqual(transitionFromGroups("therapy", a), ["waiting"])
  assert.deepEqual(transitionFromGroups("therapy", b), ["waiting"])
  assert.equal(transitionToGroup("therapy", a), "in_therapy")
  assert.equal(transitionToGroup("therapy", b), "in_therapy")
  // From any group: an empty list.
  assert.equal(transitionStartsFrom("medical", { slug: "cancelar", fromStatuses: [], fromGroups: [] }, "waiting"), true)
  assert.equal(transitionStartsFrom("therapy", a, "upcoming"), false)
  assert.equal(transitionStartsFrom("therapy", a, "waiting"), true)
})

test("storedStatus: an old-word preference and a group-name preference reach the same status", () => {
  assert.equal(storedStatus("medical", MEDICAL_6A, "presente")?.slug, "presente")
  assert.equal(storedStatus("medical", MEDICAL_6B, "waiting")?.slug, "presente")
  assert.equal(storedStatus("medical", MEDICAL_6A, "waiting")?.slug, "presente")
  assert.equal(storedStatus("medical", MEDICAL_6B, "cancelled_or_not_served")?.slug, "cancelada")
  assert.equal(storedStatus("medical", MEDICAL_6B, "nonsense"), undefined)
  assert.equal(storedStatus("medical", MEDICAL_6B, null), undefined)
})

test("rowReach: closed rows (not served, cancelled, no-show, rescheduled) rank past every step; a called row is waiting", () => {
  const past = flowRank("medical", "done") + 1
  assert.equal(rowReach("medical", notServed), past)
  assert.equal(rowReach("medical", { estado: "cancelada" }), past)
  assert.equal(rowReach("medical", { estado: "no_show" }), past)
  assert.equal(rowReach("medical", { estado: "reprogramada" }), past)
  assert.equal(rowReach("therapy", { ...notServed, status: "cancelada" }), flowRank("therapy", "done") + 1)
  assert.equal(rowReach("therapy", { ...called, status: "presente" }), flowRank("therapy", "waiting"))
  assert.equal(rowReach("medical", {}), -1)
  assert.equal(oldWordGroup("medical", "cancelada"), "cancelled_or_not_served")
  assert.equal(flowRank("medical", "no_show"), -1)
})
