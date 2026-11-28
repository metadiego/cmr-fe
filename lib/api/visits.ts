import { apiFetch } from "./client"
import type { EhrReadinessField } from "./ehr-integration"

// POST /api/v2/visits/check-in — the ONE door through which a patient becomes "present" for the
// day: consultation AND therapies together. Replaces `/frontdesk/patients/:id/present`, which only
// ever touched the therapies — a patient with ONLY a new consultation got back `{marked:[],failed:[]}`
// and the required-ID/EHR modal never opened (handoff-presente-paciente-nuevo-pide-datos,
// 27-nov-2026, real blocked patient: Caguas, "Paciente Nuevo"). A row missing patient data answers
// HTTP 200 with `code: "PACIENTE_DATOS_REQUERIDOS"` and `missingFields` — it is never a thrown error,
// so callers must read `failed[]`, not catch it.
export type CheckInRow = { id: string; kind: string }

export type CheckInFailure = CheckInRow & {
  code: string
  labelKey?: string
  message?: string
  missingFields?: EhrReadinessField[]
}

export type CheckInResult = {
  visitId: string | null
  arrived: CheckInRow[]
  skipped: CheckInRow[]
  failed: CheckInFailure[]
}

export function checkInVisit(
  patientId: string,
  centerId: string,
  opts?: { date?: string; appointmentIds?: string[] },
): Promise<CheckInResult> {
  return apiFetch<CheckInResult>(
    "/visits/check-in",
    {
      method: "POST",
      body: JSON.stringify({
        patientId,
        centerId,
        ...(opts?.date ? { date: opts.date } : {}),
        ...(opts?.appointmentIds ? { appointmentIds: opts.appointmentIds } : {}),
      }),
    },
    centerId,
  )
}
