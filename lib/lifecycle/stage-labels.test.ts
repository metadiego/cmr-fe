import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { STAGE_LABELS, stageLabel, stageLabelKey } from "./stage-labels.ts"
import type { AppointmentKind } from "./stage-groups.ts"

const AT = "2026-11-26T13:00:00Z"

// Written out on purpose: every old value lands on the label whose text it had before.
const LABEL_OF_OLD_VALUE: Record<AppointmentKind, Record<string, string>> = {
  medical: {
    programada: "booked",
    confirmada: "confirmed",
    presente: "waiting",
    triage: "triage",
    en_consulta: "in_consultation",
    atendida: "done",
    no_show: "no_show",
    cancelada: "cancelled",
    reprogramada: "rescheduled",
  },
  therapy: {
    pendiente: "upcoming",
    presente: "waiting",
    en_terapia: "in_therapy",
    asistido: "done",
    cancelada: "cancelled",
  },
}

test("each old value gets one label, from its stage", () => {
  for (const [old, label] of Object.entries(LABEL_OF_OLD_VALUE.medical))
    assert.equal(stageLabel("medical", { estado: old }), label, old)
  for (const [old, label] of Object.entries(LABEL_OF_OLD_VALUE.therapy))
    assert.equal(stageLabel("therapy", { status: old }), label, old)
})

test("not served is told apart from cancelled; a called session reads as waiting", () => {
  assert.equal(stageLabel("medical", { estado: "cancelada", arrivedAt: AT }), "not_served")
  assert.equal(stageLabel("therapy", { status: "cancelada", presentAt: AT }), "not_served")
  assert.equal(stageLabel("therapy", { status: "presente", calledAt: AT }), "waiting")
  assert.equal(stageLabel("therapy", { status: "pendiente", confirmedAt: AT }), "upcoming")
})

test("stage columns alone are labelled; an unknown status has no label", () => {
  assert.equal(stageLabel("medical", { bookingStatus: "arrived", careStatus: "in_consultation" }), "in_consultation")
  assert.equal(stageLabel("therapy", { bookingStatus: "arrived", careStatus: "not_served" }), "not_served")
  assert.equal(stageLabel("therapy", { status: "rara" }), null)
  assert.equal(stageLabel("medical", {}), null)
})

test("every label of each kind has its text in every language, the same as the old label had", () => {
  const es = JSON.parse(readFileSync(new URL("../../messages/es.json", import.meta.url), "utf8"))
  const en = JSON.parse(readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8"))
  const at = (dict: Record<string, unknown>, key: string) =>
    key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict)
  for (const kind of ["medical", "therapy"] as const)
    for (const label of STAGE_LABELS[kind])
      for (const dict of [es, en]) assert.equal(typeof at(dict, stageLabelKey(kind, label)), "string", `${kind}.${label}`)
  // The text a user saw for each old value does not change.
  const oldNs = { medical: "citas.estado", therapy: "servicios.estado" } as const
  for (const kind of ["medical", "therapy"] as const)
    for (const [old, label] of Object.entries(LABEL_OF_OLD_VALUE[kind]))
      for (const dict of [es, en])
        assert.equal(at(dict, stageLabelKey(kind, label as never)), at(dict, `${oldNs[kind]}.${old}`), `${kind}.${old}`)
  // Not served reads as the stage shown on the Citas screen.
  for (const dict of [es, en])
    for (const kind of ["medical", "therapy"] as const)
      assert.equal(at(dict, stageLabelKey(kind, "not_served")), at(dict, "lifecycle.stage.not_served"))
})
