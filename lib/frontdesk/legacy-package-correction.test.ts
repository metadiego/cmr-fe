import { test } from "node:test"
import assert from "node:assert/strict"

import {
  closePackageForm,
  legacyPackageCorrectionInvalid,
  legacyPackageCorrectionMissing,
  legacyPackageCorrectionPayload,
  type LegacyPackageCorrectionForm,
} from "./legacy-package-correction.ts"

const form = (over: Partial<LegacyPackageCorrectionForm> = {}): LegacyPackageCorrectionForm => ({
  totalSessions: "12",
  deliveredSessions: "6",
  motivo: "El legado marca 6/12",
  ...over,
})

test("missing: all three empty", () => {
  assert.deepEqual(
    legacyPackageCorrectionMissing(form({ totalSessions: "", deliveredSessions: "", motivo: "" })),
    ["total", "delivered", "reason"],
  )
})

test("missing: nothing missing once filled", () => {
  assert.deepEqual(legacyPackageCorrectionMissing(form()), [])
})

test("invalid: null while a number is still empty (missing owns that, not invalid)", () => {
  assert.equal(legacyPackageCorrectionInvalid(form({ totalSessions: "" })), null)
})

test("invalid: not an integer", () => {
  assert.equal(legacyPackageCorrectionInvalid(form({ totalSessions: "12.5" })), "notInteger")
})

test("invalid: negative", () => {
  assert.equal(legacyPackageCorrectionInvalid(form({ deliveredSessions: "-1" })), "negative")
})

test("invalid: delivered over total", () => {
  assert.equal(legacyPackageCorrectionInvalid(form({ totalSessions: "4", deliveredSessions: "6" })), "deliveredOverTotal")
})

test("invalid: null once both numbers are sane", () => {
  assert.equal(legacyPackageCorrectionInvalid(form()), null)
})

test("closePackageForm: total becomes delivered", () => {
  assert.equal(closePackageForm(form({ totalSessions: "12", deliveredSessions: "6" })).totalSessions, "6")
})

test("payload: sends only what changed from the package's current numbers", () => {
  const p = legacyPackageCorrectionPayload(form({ totalSessions: "12", deliveredSessions: "4" }), {
    totalSessions: 12,
    deliveredSessions: 6,
  })
  assert.deepEqual(p, { motivo: "El legado marca 6/12", deliveredSessions: 4 })
})

test("payload: both fields when both changed", () => {
  const p = legacyPackageCorrectionPayload(form({ totalSessions: "10", deliveredSessions: "4" }), {
    totalSessions: 12,
    deliveredSessions: 6,
  })
  assert.deepEqual(p, { motivo: "El legado marca 6/12", totalSessions: 10, deliveredSessions: 4 })
})

test("payload: neither field when nothing changed", () => {
  const p = legacyPackageCorrectionPayload(form({ totalSessions: "12", deliveredSessions: "6" }), {
    totalSessions: 12,
    deliveredSessions: 6,
  })
  assert.deepEqual(p, { motivo: "El legado marca 6/12" })
})
