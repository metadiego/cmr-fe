// The patient's doctor always shows in a doctor select, even when the select's options (the ACTIVE
// doctors of this center) do not include them — retired, or from another center. Without an option
// for the id, a <Select> renders blank and the doctor "disappears" (owner, 14-oct-2026; ~40k patients
// have a retired doctor). Shared by general billing and agregar-cita. Handoff
// facturacion-general-medico-del-paciente.

export type DoctorMark =
  | { kind: "retired" }
  | { kind: "otherCenter"; center: string }

export interface PatientDoctor {
  doctorId?: string | null
  doctorName?: string | null
  doctorClinicId?: string | null
  doctorClinicName?: string | null
}

// null when there is no doctor or they are already among the options. Otherwise the extra option:
// "retired" if the doctor belongs to THIS center (so they are missing because they are not active),
// else "other center" with its name.
export function patientDoctorOption(
  optionIds: string[],
  patient: PatientDoctor | null | undefined,
  centerId: string | null | undefined
): { id: string; name: string; mark: DoctorMark } | null {
  const id = patient?.doctorId
  if (!id || optionIds.includes(id)) return null
  const name = patient?.doctorName || id
  const mark: DoctorMark =
    centerId && patient?.doctorClinicId === centerId
      ? { kind: "retired" }
      : { kind: "otherCenter", center: patient?.doctorClinicName ?? "" }
  return { id, name, mark }
}
