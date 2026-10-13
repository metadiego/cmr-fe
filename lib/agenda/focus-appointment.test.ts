import { test } from "node:test"
import assert from "node:assert/strict"
import { focusAppointment, hasAppointment } from "./focus-appointment.ts"

const center = {
  name: "CMR Bayamon",
  franjas: [
    {
      time: "09:00",
      tipos: [
        {
          appointmentTypeId: "t1",
          vacios: 2,
          appointments: [{ id: "a" }, { id: "b" }],
        },
      ],
    },
    {
      time: null,
      tipos: [
        { appointmentTypeId: "t2", vacios: 0, appointments: [{ id: "new" }] },
        { appointmentTypeId: "t1", vacios: 0, appointments: [{ id: "c" }] },
      ],
    },
  ],
}

test("focus keeps only the appointment with that id, dropping empty slots and types", () => {
  const out = focusAppointment(center, "new")
  assert.deepEqual(
    out.franjas?.map((s) => s.time),
    [null]
  )
  assert.deepEqual(
    out.franjas?.[0].tipos.map((t) => t.appointments.map((a) => a.id)),
    [["new"]]
  )
  assert.equal(out.name, "CMR Bayamon")
  // The original is untouched (clearing the filter shows everything again).
  assert.equal(center.franjas[0].tipos[0].appointments.length, 2)
})

test("no id = no filter; hasAppointment tells whether it is in that day", () => {
  assert.equal(focusAppointment(center, null), center)
  assert.equal(hasAppointment(center, "c"), true)
  assert.equal(hasAppointment(center, "zz"), false)
})
