import { test } from "node:test"
import assert from "node:assert/strict"

import type { HistorialSesion } from "./patient-therapy-history.ts"
import { stageLabel } from "../lifecycle/stage-labels.ts"

const row = (over: Partial<HistorialSesion>): HistorialSesion => ({
  id: "s1",
  date: "2026-11-25",
  status: "cancelada",
  bookingStatus: "cancelled",
  careStatus: null,
  serviceId: "apex",
  serviceName: "APEX",
  sesionNumero: null,
  totalSessions: null,
  areas: null,
  staffNombre: null,
  ...over,
})

test("the record's Therapies tab tells not served from cancelled by the stages the history sends", () => {
  assert.equal(stageLabel("therapy", row({ bookingStatus: "arrived", careStatus: "not_served" })), "not_served")
  assert.equal(stageLabel("therapy", row({})), "cancelled")
})

test("a history row without stages (an older backend) still reads from its status", () => {
  assert.equal(stageLabel("therapy", row({ bookingStatus: undefined, careStatus: undefined })), "cancelled")
  assert.equal(stageLabel("therapy", row({ status: "asistido", bookingStatus: undefined, careStatus: undefined })), "done")
})
