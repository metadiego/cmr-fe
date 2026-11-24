import { test } from "node:test"
import assert from "node:assert/strict"
import { citaBlockingCode } from "./cita-errors.ts"
import { ApiError } from "./types.ts"

test("VISIT_IN_PROGRESS: returns its own code", () => {
  const err = new ApiError("VISIT_IN_PROGRESS", "visita en curso", 409, undefined, "citas.error.visit_in_progress", { estado: "presente" })
  assert.equal(citaBlockingCode(err), "VISIT_IN_PROGRESS")
})

test("APPOINTMENT_DATE_IN_PAST: returns its own code", () => {
  const err = new ApiError("APPOINTMENT_DATE_IN_PAST", "fecha pasada", 400, undefined, "citas.error.date_in_past", { fecha: "2026-01-01" })
  assert.equal(citaBlockingCode(err), "APPOINTMENT_DATE_IN_PAST")
})

test("a different ApiError code: null — this is not a blocking error", () => {
  const err = new ApiError("OTRO_CODIGO", "algo más", 400)
  assert.equal(citaBlockingCode(err), null)
})

test("a non-ApiError value (network failure, plain Error): null, never throws", () => {
  assert.equal(citaBlockingCode(new Error("network down")), null)
  assert.equal(citaBlockingCode("boom"), null)
  assert.equal(citaBlockingCode(null), null)
  assert.equal(citaBlockingCode(undefined), null)
})
