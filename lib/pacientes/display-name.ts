import type { Paciente } from "../api/pacientes.ts";

// The name a patient is shown by: the BE's displayName when it sends one, else first + last name.
export function patientName(p: Pick<Paciente, "firstName" | "lastName"> & { displayName?: string | null }): string {
  return p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ");
}
