import { test } from "node:test"
import assert from "node:assert/strict"

import { doctorsStatus, freeDoctors } from "./doctors-free.ts"

test("a doctor with every row NOT en_consulta is free", () => {
  const rows = [
    { id: "r1", medico: "Victor M. Ocasio", medico__valor: "d1", estado: "confirmada" },
    { id: "r2", medico: "Victor M. Ocasio", medico__valor: "d1", estado: "atendida" },
  ]
  assert.deepEqual(doctorsStatus(rows), [{ id: "d1", name: "Victor M. Ocasio", free: true }])
})

test("a doctor with ANY row en_consulta right now is busy, even with other free rows", () => {
  const rows = [
    { id: "r1", medico: "Christina Rosa", medico__valor: "d2", estado: "en_consulta" },
    { id: "r2", medico: "Christina Rosa", medico__valor: "d2", estado: "atendida" },
  ]
  assert.deepEqual(doctorsStatus(rows), [{ id: "d2", name: "Christina Rosa", free: false }])
  assert.deepEqual(freeDoctors(rows), [])
})

test("a doctor with no row today is not reported at all — unscheduled is not the same as free", () => {
  assert.deepEqual(doctorsStatus([]), [])
})

test("freeDoctors filters out the busy ones, keeping the free list sorted by name", () => {
  const rows = [
    { id: "r1", medico: "Zoe", medico__valor: "d1", estado: "confirmada" },
    { id: "r2", medico: "Ana", medico__valor: "d2", estado: "en_consulta" },
    { id: "r3", medico: "Beto", medico__valor: "d3", estado: "presente" },
  ]
  assert.deepEqual(
    freeDoctors(rows).map((d) => d.name),
    ["Beto", "Zoe"]
  )
})
