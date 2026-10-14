import { test } from "node:test"
import assert from "node:assert/strict"
import { pickDoctor } from "./pick-doctor.ts"

const options = [
  { value: "d-edwin", label: "Edwin Perez" },
  { value: "d-emmanuel", label: "Emmanuel Martinez" },
]

test("the appointment's doctor id wins, whatever name the stale row shows", () => {
  assert.equal(
    pickDoctor(options, { id: "d-emmanuel", name: "" }),
    "d-emmanuel"
  )
  assert.equal(
    pickDoctor(options, { id: "d-emmanuel", name: "Edwin Perez" }),
    "d-emmanuel"
  )
})

test("by name only when there is no usable id", () => {
  assert.equal(
    pickDoctor(options, { id: "d-gone", name: "Edwin Perez" }),
    "d-edwin"
  )
  assert.equal(pickDoctor(options, { name: "Nobody" }), null)
  assert.equal(pickDoctor(options, {}), null)
})
