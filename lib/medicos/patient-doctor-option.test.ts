import { test } from "node:test"
import assert from "node:assert/strict"
import { patientDoctorOption } from "./patient-doctor-option.ts"

const BAY = "bay"
const active = ["d-active"]

test("an active doctor of the center: already an option, nothing added", () => {
  assert.equal(
    patientDoctorOption(
      active,
      { doctorId: "d-active", doctorName: "Edwin Perez", doctorClinicId: BAY },
      BAY
    ),
    null
  )
})

test("a retired doctor of this center: added, marked retired", () => {
  assert.deepEqual(
    patientDoctorOption(
      active,
      {
        doctorId: "d-pagan",
        doctorName: "Juan Pagan",
        doctorClinicId: BAY,
        doctorClinicName: "CMR Bayamon",
      },
      BAY
    ),
    { id: "d-pagan", name: "Juan Pagan", mark: { kind: "retired" } }
  )
})

test("a doctor of another center: added with that center's name", () => {
  assert.deepEqual(
    patientDoctorOption(
      active,
      {
        doctorId: "d-cag",
        doctorName: "Ana Ruiz",
        doctorClinicId: "cag",
        doctorClinicName: "CMR Caguas",
      },
      BAY
    ),
    {
      id: "d-cag",
      name: "Ana Ruiz",
      mark: { kind: "otherCenter", center: "CMR Caguas" },
    }
  )
})

test("no doctor: nothing (the select shows «Sin médico»)", () => {
  assert.equal(patientDoctorOption(active, { doctorId: null }, BAY), null)
  assert.equal(patientDoctorOption(active, null, BAY), null)
})
