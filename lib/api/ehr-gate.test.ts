import { test } from "node:test"
import assert from "node:assert/strict"
import { datosFaltantesDe } from "./ehr-gate.ts"
import { ApiError } from "./types.ts"

test("PACIENTE_DATOS_REQUERIDOS with faltantes: returns them", () => {
  const err = new ApiError(
    "PACIENTE_DATOS_REQUERIDOS",
    "faltan datos",
    400,
    undefined,
    undefined,
    { faltantes: ["docId", "idType"] }
  )
  assert.deepEqual(datosFaltantesDe(err), ["docId", "idType"])
})

test("PACIENTE_DATOS_REQUERIDOS with an empty faltantes array: null, nothing to ask for", () => {
  const err = new ApiError(
    "PACIENTE_DATOS_REQUERIDOS",
    "faltan datos",
    400,
    undefined,
    undefined,
    { faltantes: [] }
  )
  assert.equal(datosFaltantesDe(err), null)
})

test("PACIENTE_DATOS_REQUERIDOS without a faltantes field at all: null, not a crash", () => {
  const err = new ApiError("PACIENTE_DATOS_REQUERIDOS", "faltan datos", 400)
  assert.equal(datosFaltantesDe(err), null)
})

test("a different ApiError code: null — this is not the data-missing gate", () => {
  const err = new ApiError("OTRO_CODIGO", "algo más", 400, undefined, undefined, {
    faltantes: ["docId"],
  })
  assert.equal(datosFaltantesDe(err), null)
})

test("a non-ApiError value (network failure, plain Error): null, never throws", () => {
  assert.equal(datosFaltantesDe(new Error("network down")), null)
  assert.equal(datosFaltantesDe("boom"), null)
  assert.equal(datosFaltantesDe(null), null)
  assert.equal(datosFaltantesDe(undefined), null)
})
