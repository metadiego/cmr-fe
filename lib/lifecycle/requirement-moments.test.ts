import { test } from "node:test"
import assert from "node:assert/strict"

import { momentStep, REQUIREMENT_MOMENTS } from "./requirement-moments.ts"

test("momentStep: both names reach the old step name; the app offers only the old ones", () => {
  assert.equal(momentStep("check_in"), "presente")
  assert.equal(momentStep("start_therapy"), "en_terapia")
  assert.equal(momentStep("finish"), "asistido")
  assert.equal(momentStep("asistido"), "asistido")
  assert.equal(momentStep(undefined), null)
  assert.deepEqual(REQUIREMENT_MOMENTS, ["presente", "en_terapia", "asistido"])
})
