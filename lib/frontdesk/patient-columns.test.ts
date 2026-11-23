import { test } from "node:test"
import assert from "node:assert/strict"
import {
  blockColumns,
  doctorAndFlowFirst,
  hidePresente,
  hideServiceStatus,
  notifyColumn,
  patientFirst,
  staffAndFlowFirst,
} from "./patient-columns.ts"

const cols = [
  { clave: "fd_paciente" },
  { clave: "fd_record" },
  { clave: "fd_enfermera" },
  { clave: "fd_notificar", render: { kind: "notificar", panel: "enfermeria" } },
  { clave: "fd_dosis" },
]

test("a patient's service block drops name, record and the notify bell", () => {
  assert.deepEqual(
    blockColumns(cols).map((c) => c.clave),
    ["fd_enfermera", "fd_dosis"]
  )
})

test("the consultation board's own keys too", () => {
  assert.deepEqual(
    blockColumns([
      { clave: "record" },
      { clave: "paciente" },
      { clave: "medico" },
      { clave: "citas_notificar", render: { kind: "notificar" } },
    ]).map((c) => c.clave),
    ["medico"]
  )
})

test("owner, 23-nov: a secondary viewer keeps name and record with keepPatient, still drops the bell", () => {
  assert.deepEqual(
    blockColumns(cols, { keepPatient: true }).map((c) => c.clave),
    ["fd_paciente", "fd_record", "fd_enfermera", "fd_dosis"]
  )
  // Default behavior (patient-desk) is unchanged when the option is omitted.
  assert.deepEqual(blockColumns(cols).map((c) => c.clave), ["fd_enfermera", "fd_dosis"])
})

test("patientFirst: record then name, ahead of everything else, whatever the board's own order", () => {
  const col = (clave: string) => ({ kind: "col" as const, col: { clave } })
  const items = [col("fd_enfermera"), col("fd_paciente"), col("fd_dosis"), col("fd_record")]
  assert.deepEqual(
    patientFirst(items).map((i) => i.col.clave),
    ["fd_record", "fd_paciente", "fd_enfermera", "fd_dosis"]
  )
})

test("patientFirst is a no-op without name/record columns", () => {
  const col = (clave: string) => ({ kind: "col" as const, col: { clave } })
  const items = [col("fd_enfermera"), col("fd_dosis")]
  assert.deepEqual(patientFirst(items), items)
})

test("the notify column is found by its render kind, whatever its key", () => {
  assert.equal(notifyColumn(cols)?.clave, "fd_notificar")
  assert.equal(notifyColumn([{ clave: "x" }]), undefined)
})

test("hidePresente drops only the consultation's own presente column, keeps the rest in order", () => {
  const atencionCols = [
    { clave: "medico" },
    { clave: "presente" },
    { clave: "en_consulta" },
    { clave: "asistido" },
  ]
  assert.deepEqual(
    hidePresente(atencionCols).map((c) => c.clave),
    ["medico", "en_consulta", "asistido"]
  )
})

test("hidePresente is a no-op when there is no presente column", () => {
  assert.deepEqual(
    hidePresente(cols).map((c) => c.clave),
    cols.map((c) => c.clave)
  )
})

test("service blocks drop their own status column (fd_estado) and nothing else", () => {
  const c = [
    { clave: "fd_tecnico" },
    { clave: "fd_estado" },
    { clave: "fd_sesiones" },
  ]
  assert.deepEqual(
    hideServiceStatus(c).map((x) => x.clave),
    ["fd_tecnico", "fd_sesiones"]
  )
})

test("staff column, flow, then session first, the rest in their order — whatever the board's order", () => {
  const col = (clave: string) => ({ kind: "col" as const, col: { clave } })
  const flow = { kind: "flujo" as const }
  const vitc = [
    col("fd_cantidad"),
    flow,
    col("fd_enfermera"),
    col("fd_dosis"),
    col("fd_sesiones"),
  ]
  const out = staffAndFlowFirst(vitc).map((i) =>
    i.kind === "flujo" ? "FLOW" : i.col.clave
  )
  assert.deepEqual(out, [
    "fd_enfermera",
    "FLOW",
    "fd_sesiones",
    "fd_cantidad",
    "fd_dosis",
  ])
  // A board without a staff column still starts with the flow.
  assert.deepEqual(
    staffAndFlowFirst([col("fd_sesiones"), flow]).map((i) => i.kind),
    ["flujo", "col"]
  )
})

test("consultation: doctor, then its flow, then the rest in order", () => {
  const flow = (clave: string) => ({ clave, render: { group: "flujo" } })
  const cols = [
    { clave: "tipo" },
    flow("en_consulta"),
    flow("atendida"),
    { clave: "medico" },
    { clave: "comentarios" },
  ]
  assert.deepEqual(
    doctorAndFlowFirst(cols).map((c) => c.clave),
    ["medico", "en_consulta", "atendida", "tipo", "comentarios"]
  )
})
