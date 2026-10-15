// Which doctor option to preselect for an appointment: by id first (the appointment's doctorId, or the
// board row's `medico__valor`), by visible name only as a last resort. Matching by name alone lost the
// doctor whenever the row in hand was older than the edit (owner's report, 14-oct-2026: «le coloqué el
// médico… y cuando lo voy a asistir, le quitó el médico» — the appointment still had it).
export interface DoctorOption {
  value: string
  label: string
}

export function pickDoctor(
  options: DoctorOption[],
  doctor: { id?: string | null; name?: string | null }
): string | null {
  if (doctor.id && options.some((o) => o.value === doctor.id)) return doctor.id
  if (doctor.name)
    return options.find((o) => o.label === doctor.name)?.value ?? null
  return null
}
