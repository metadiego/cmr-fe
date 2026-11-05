import { test } from "node:test"
import assert from "node:assert/strict"

import { pendingArrivals, sortByArrival } from "./patient-day.ts"

test("consultation view: every present patient together by arrival, finished or not; then not arrived; cancelled last", () => {
  const base = {
    record: "",
    services: [],
    consultationIds: ["c"],
    consultationStatuses: ["asistido"],
    consultationSubtypes: [""],
    allCancelled: false,
    consultationPresentAt: null,
  }
  const list = [
    { ...base, patientId: "late", name: "Late", presentAt: "2026-11-04T14:30:00Z", earliestTime: "09:00" },
    { ...base, patientId: "none2", name: "None B", presentAt: null, earliestTime: "11:00" },
    { ...base, patientId: "x", name: "Cancelled", presentAt: null, earliestTime: "08:00", allCancelled: true },
    { ...base, patientId: "early", name: "Early", presentAt: "2026-11-04T11:53:00Z", earliestTime: "08:00" },
    { ...base, patientId: "none1", name: "None A", presentAt: null, earliestTime: "10:00" },
  ]
  assert.deepEqual(
    sortByArrival(list).map((p) => p.patientId),
    ["early", "late", "none1", "none2", "x"]
  )
})

test("present patient: counts sessions still pendiente and consultations not yet present", () => {
  const svc = (statuses: string[]) => ({
    serviceId: "s", slug: "s", name: "S", color: null, staffGroup: 0 as never, sessionIds: statuses.map((_, i) => String(i)), statuses,
  })
  const p = {
    patientId: "p", name: "P", record: "", earliestTime: null, presentAt: "2026-11-04T14:00:00Z", consultationPresentAt: null, allCancelled: false,
    services: [svc(["presente", "pendiente"]), svc(["asistido"])],
    consultationIds: ["c1", "c2"], consultationStatuses: ["confirmada", "en_consulta"], consultationSubtypes: ["", ""],
  }
  assert.equal(pendingArrivals(p), 2)
  assert.equal(pendingArrivals({ ...p, services: [svc(["presente"])], consultationStatuses: ["presente", "asistido"] }), 0)
})

test("consultation view: a patient who came only for therapies reads not present there", async () => {
  const { asConsultationView } = await import("./patient-day.ts")
  const p = {
    patientId: "p", name: "P", record: "", earliestTime: null, allCancelled: false, services: [],
    presentAt: "2026-11-04T14:47:00Z", consultationPresentAt: null,
    consultationIds: ["c"], consultationStatuses: ["confirmada"], consultationSubtypes: [""],
  }
  assert.equal(asConsultationView(p).presentAt, null)
  assert.equal(asConsultationView({ ...p, consultationPresentAt: "2026-11-04T15:00:00Z" }).presentAt, "2026-11-04T15:00:00Z")
})
