import { test } from "node:test"
import assert from "node:assert/strict"

import { vialCorrectionCheck } from "./vial-correction.ts"

test("vialCorrectionCheck: taking out is capped by the remnant", () => {
  const r = vialCorrectionCheck({
    raw: "30",
    sign: "retirar",
    remnant: 25,
    capacity: 50,
  })
  assert.deepEqual(r, { amount: 30, outOfRange: true, max: 25 })
  assert.equal(
    vialCorrectionCheck({
      raw: "25",
      sign: "retirar",
      remnant: 25,
      capacity: 50,
    }).outOfRange,
    false
  )
})

test("vialCorrectionCheck: putting back is capped by the room left in the vial", () => {
  assert.deepEqual(
    vialCorrectionCheck({
      raw: "25",
      sign: "devolver",
      remnant: 30,
      capacity: 50,
    }),
    {
      amount: 25,
      outOfRange: true,
      max: 20,
    }
  )
  assert.equal(
    vialCorrectionCheck({
      raw: "20",
      sign: "devolver",
      remnant: 30,
      capacity: 50,
    }).outOfRange,
    false
  )
})

test("vialCorrectionCheck: empty, zero, negative or text is not an amount (missing, not out of range)", () => {
  for (const raw of ["", "  ", "0", "-3", "abc"]) {
    const r = vialCorrectionCheck({
      raw,
      sign: "retirar",
      remnant: 10,
      capacity: 50,
    })
    assert.equal(r.amount, null, raw)
    assert.equal(r.outOfRange, false, raw)
  }
})

test("vialCorrectionCheck: a decimal comma is read, and float noise is tolerated", () => {
  assert.equal(
    vialCorrectionCheck({
      raw: "2,5",
      sign: "retirar",
      remnant: 10,
      capacity: 50,
    }).amount,
    2.5
  )
  assert.equal(
    vialCorrectionCheck({
      raw: "0.3",
      sign: "retirar",
      remnant: 0.1 + 0.2,
      capacity: 1,
    }).outOfRange,
    false
  )
})

test("vialCorrectionCheck: a negative remnant (over-applied) allows no take-out and the full capacity back", () => {
  const r = vialCorrectionCheck({
    raw: "1",
    sign: "retirar",
    remnant: -4,
    capacity: 50,
  })
  assert.equal(r.max, 0)
  assert.equal(r.outOfRange, true)
  assert.equal(
    vialCorrectionCheck({
      raw: "50",
      sign: "devolver",
      remnant: -4,
      capacity: 50,
    }).outOfRange,
    false
  )
})
