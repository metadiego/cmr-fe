import { test } from "node:test"
import assert from "node:assert/strict"

import { bookedCount, toBookCount } from "./service-balance.ts"
import type { Sesion } from "../api/frontdesk.ts"

function sesion(over: Record<string, unknown>): Sesion {
  return {
    id: "s1",
    serviceId: "sv1",
    date: "2026-11-30",
    time: "07:00:00",
    status: "pendiente",
    ...over,
  } as unknown as Sesion
}

test("bookedCount: a future, not-attended, not-cancelled session is booked", () => {
  assert.equal(bookedCount([sesion({})], "2026-11-28"), 1)
})

test("bookedCount: today counts, yesterday does not", () => {
  assert.equal(bookedCount([sesion({ date: "2026-11-28" })], "2026-11-28"), 1)
  assert.equal(bookedCount([sesion({ date: "2026-11-27" })], "2026-11-28"), 0)
})

test("bookedCount: an auto-present same-day visit is booked, not used (status stays pendiente/presente)", () => {
  assert.equal(bookedCount([sesion({ date: "2026-11-28", status: "presente" })], "2026-11-28"), 1)
})

test("bookedCount: attended or cancelled sessions never count", () => {
  assert.equal(bookedCount([sesion({ status: "asistido" })], "2026-11-28"), 0)
  assert.equal(bookedCount([sesion({ status: "cancelada" })], "2026-11-28"), 0)
})

test("bookedCount: mixed list only counts the live upcoming ones", () => {
  const sessions = [
    sesion({ date: "2026-11-30", status: "pendiente" }),
    sesion({ date: "2026-11-25", status: "asistido" }),
    sesion({ date: "2026-12-05", status: "cancelada" }),
  ]
  assert.equal(bookedCount(sessions, "2026-11-28"), 1)
})

test("toBookCount: pending minus booked", () => {
  assert.equal(toBookCount(3, 1), 2)
})

test("toBookCount: never negative", () => {
  assert.equal(toBookCount(1, 3), 0)
  assert.equal(toBookCount(0, 0), 0)
})
