import { test } from "node:test"
import assert from "node:assert/strict"
import {
  filterByKind,
  filterPatients,
  groupByPatient,
  patientConcluded,
  serviceConcluded,
  type DaySession,
} from "./patient-day.ts"

const services = [
  { id: "s-apex", slug: "apex", name: "APEX", color: "#1d4ed8" },
  { id: "s-laser", slug: "laser", name: "LÁSER", color: "#ea580c" },
]
const ses = (
  id: string,
  patientId: string,
  serviceId: string,
  extra: Partial<DaySession> = {}
): DaySession => ({
  id,
  patientId,
  serviceId,
  status: "pendiente",
  time: "09:00:00",
  patient: {
    id: patientId,
    name: patientId === "p1" ? "RAMOS HUECA, LILLIAM" : "VALENTÍN, MARÍA",
    medicalRecordNumber: patientId === "p1" ? "12345" : "102796",
  },
  ...extra,
})

test("one entry per patient with every service they have today, in the configured service order", () => {
  const out = groupByPatient(
    [
      ses("a", "p1", "s-laser"),
      ses("b", "p1", "s-apex"),
      ses("c", "p1", "s-laser", { time: "10:00:00" }),
    ],
    [],
    services
  )
  assert.equal(out.length, 1)
  assert.deepEqual(
    out[0].services.map((s) => [s.slug, s.sessionIds]),
    [
      ["apex", ["b"]],
      ["laser", ["a", "c"]],
    ]
  )
  assert.equal(out[0].earliestTime, "09:00")
  assert.equal(out[0].record, "12345")
})

test("consultations join the same patient (Spanish keys of the consultation board)", () => {
  const out = groupByPatient(
    [ses("a", "p1", "s-apex")],
    [
      {
        id: "c1",
        pacienteId: "p1",
        paciente: "RAMOS HUECA, LILLIAM",
        record: "12345",
        estado: "atendida",
      },
    ],
    services
  )
  assert.deepEqual(out[0].consultationIds, ["c1"])
  assert.deepEqual(out[0].consultationStatuses, ["atendida"])
})

test("a patient with only a consultation still shows up", () => {
  const out = groupByPatient(
    [],
    [
      {
        id: "c1",
        pacienteId: "p9",
        paciente: "PADILLA, LUIS",
        record: "92720",
        estado: "pendiente",
      },
    ],
    services
  )
  assert.equal(out[0].name, "PADILLA, LUIS")
  assert.equal(out[0].services.length, 0)
})

test("order: arrived first (by arrival), then earliest booking, cancelled-only days last", () => {
  const out = groupByPatient(
    [
      ses("a", "p1", "s-apex", { time: "08:00:00" }),
      ses("b", "p2", "s-apex", {
        time: "11:00:00",
        presentAt: "2026-10-09T13:05:00Z",
      }),
      ses("c", "p3", "s-apex", {
        time: "07:00:00",
        status: "cancelada",
        patient: { name: "ZZ", medicalRecordNumber: "1" },
      }),
    ],
    [],
    services
  )
  assert.deepEqual(
    out.map((p) => p.patientId),
    ["p2", "p1", "p3"]
  )
})

test("search ignores accents and case, and also finds by record or service", () => {
  const out = groupByPatient(
    [ses("a", "p1", "s-apex"), ses("b", "p2", "s-laser")],
    [],
    services
  )
  assert.deepEqual(
    filterPatients(out, "valentin").map((p) => p.patientId),
    ["p2"]
  )
  assert.deepEqual(
    filterPatients(out, "12345").map((p) => p.patientId),
    ["p1"]
  )
  assert.deepEqual(
    filterPatients(out, "laser").map((p) => p.patientId),
    ["p2"]
  )
  assert.equal(filterPatients(out, "  ").length, 2)
})

test("services / consultation / all toggle: a patient with both shows in both", () => {
  const out = groupByPatient(
    [ses("a", "p1", "s-apex"), ses("b", "p2", "s-laser")],
    [
      {
        id: "c1",
        pacienteId: "p1",
        paciente: "RAMOS HUECA, LILLIAM",
        estado: "pendiente",
      },
      {
        id: "c2",
        pacienteId: "p9",
        paciente: "PADILLA, LUIS",
        estado: "pendiente",
      },
    ],
    services
  )
  assert.deepEqual(
    filterByKind(out, "services")
      .map((p) => p.patientId)
      .sort(),
    ["p1", "p2"]
  )
  assert.deepEqual(
    filterByKind(out, "consultation")
      .map((p) => p.patientId)
      .sort(),
    ["p1", "p9"]
  )
  assert.equal(filterByKind(out, "all").length, 3)
})

test("a service is concluded when all its sessions are attended; cancelled ones do not hold it open", () => {
  const [p] = groupByPatient(
    [
      ses("a", "p1", "s-apex", { status: "asistido" }),
      ses("b", "p1", "s-apex", { status: "cancelada" }),
      ses("c", "p1", "s-laser", { status: "presente" }),
    ],
    [],
    services
  )
  assert.deepEqual(p.services.map(serviceConcluded), [true, false])
  assert.equal(patientConcluded(p), false)
  const [onlyCancelled] = groupByPatient(
    [ses("d", "p2", "s-apex", { status: "cancelada" })],
    [],
    services
  )
  assert.equal(serviceConcluded(onlyCancelled.services[0]), false)
})

test("patients with every service attended sink to the bottom, keeping their order; a consultation keeps them up", () => {
  const out = groupByPatient(
    [
      ses("a", "p1", "s-apex", {
        status: "asistido",
        presentAt: "2026-10-10T12:00:00Z",
      }),
      ses("b", "p2", "s-apex", {
        status: "asistido",
        presentAt: "2026-10-10T12:30:00Z",
        patient: { name: "B", medicalRecordNumber: "2" },
      }),
      ses("c", "p3", "s-apex", {
        status: "presente",
        presentAt: "2026-10-10T13:00:00Z",
        patient: { name: "C", medicalRecordNumber: "3" },
      }),
      ses("d", "p4", "s-apex", {
        status: "cancelada",
        patient: { name: "D", medicalRecordNumber: "4" },
      }),
      ses("e", "p5", "s-apex", {
        status: "asistido",
        presentAt: "2026-10-10T11:00:00Z",
        patient: { name: "E", medicalRecordNumber: "5" },
      }),
    ],
    [
      {
        id: "c1",
        pacienteId: "p5",
        paciente: "E",
        record: "5",
        estado: "pendiente",
      },
    ],
    services
  )
  assert.deepEqual(
    out.map((p) => p.patientId),
    ["p5", "p3", "p1", "p2", "p4"]
  )
})

test("a consultation in a terminal status no longer keeps the patient up; one cancelled or a no-show alone does not sink them", () => {
  const terminal = (x: string) =>
    ["atendida", "no_show", "cancelada", "reprogramada"].includes(x)
  const day = (estado: string, sessions: DaySession[] = []) =>
    groupByPatient(
      sessions,
      [{ id: "c1", pacienteId: "p1", paciente: "A", record: "1", estado }],
      services,
      terminal
    )[0]
  assert.equal(patientConcluded(day("en_consulta"), terminal), false)
  assert.equal(patientConcluded(day("atendida"), terminal), true)
  assert.equal(patientConcluded(day("no_show"), terminal), false)
  assert.equal(
    patientConcluded(
      day("no_show", [ses("a", "p1", "s-apex", { status: "asistido" })]),
      terminal
    ),
    true
  )
  assert.equal(
    patientConcluded(
      day("atendida", [ses("a", "p1", "s-apex", { status: "presente" })]),
      terminal
    ),
    false
  )
  // Without the board's catalog no consultation counts as finished.
  assert.equal(patientConcluded(day("atendida")), false)
})

test("a cancelled session's leftover presentAt does not make the patient look arrived (found live 10-oct-2026)", () => {
  const [p] = groupByPatient(
    [
      ses("a", "p1", "s-apex", { status: "cancelada", presentAt: "2026-10-10T20:56:00Z" }),
      ses("b", "p1", "s-laser", { status: "pendiente", presentAt: null }),
    ],
    [],
    services
  )
  assert.equal(p.presentAt, null)
})

test("but a GENUINE presentAt on a non-cancelled session still counts, even next to a cancelled one", () => {
  const [p] = groupByPatient(
    [
      ses("a", "p1", "s-apex", { status: "cancelada", presentAt: "2026-10-10T20:56:00Z" }),
      ses("b", "p1", "s-laser", { status: "presente", presentAt: "2026-10-10T21:10:00Z" }),
    ],
    [],
    services
  )
  assert.equal(p.presentAt, "2026-10-10T21:10:00Z")
})
