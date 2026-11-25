import { test } from "node:test"
import assert from "node:assert/strict"

import { bookedUnconfirmedNotice, confirmToggleShown, createConfirmed, heldInCenter } from "./confirm-on-create.ts"

test("held in the target center: true, false, or unknown while loading / without a target", () => {
  const centers = [{ id: "c1" }, { id: "c2" }]
  assert.equal(heldInCenter(centers, "c1"), true)
  assert.equal(heldInCenter(centers, "c9"), false)
  assert.equal(heldInCenter(null, "c1"), null)
  assert.equal(heldInCenter(centers, null), null)
})

test("born confirmed only when asked AND not known to be refused in that center", () => {
  assert.equal(createConfirmed(true, true), true)
  assert.equal(createConfirmed(true, null), true) // not known yet: the backend still checks (403)
  assert.equal(createConfirmed(true, false), false) // no appointments.confirm there: born booked
  assert.equal(createConfirmed(false, true), false)
})

test("a flow with no toggle asks for confirmed: unknown permission sends true, known missing sends false", () => {
  assert.equal(createConfirmed(true, null), true)
  assert.equal(createConfirmed(true, false), false)
  assert.equal(createConfirmed(true, true), true)
})

test("the confirm toggle shows unless the permission is known to be missing (same rule on every form)", () => {
  assert.equal(confirmToggleShown(true), true)
  assert.equal(confirmToggleShown(null), true)
  assert.equal(confirmToggleShown(false), false)
})

test("the booked-unconfirmed notice only when a confirmed booking was wanted and the permission is known missing", () => {
  assert.equal(bookedUnconfirmedNotice(true, false), true)
  assert.equal(bookedUnconfirmedNotice(true, null), false)
  assert.equal(bookedUnconfirmedNotice(true, true), false)
  assert.equal(bookedUnconfirmedNotice(false, false), false)
})
