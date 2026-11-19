import { apiFetch } from "./client";

// Fixing the «n/m» that the legacy system wrote on migrated sessions (owner 19-nov-2026: record 103115 of
// Bayamón shows «1/8» on a 12-session series). Only rows with `migrated: true`; the ones born here are
// numbered by their package. cmr-be #641, handoff docs/specs/numeracion-de-sesiones-migradas-handoff.md.
// Permission: frontdesk.disponibilidad.editar.

export function correctLegacyLabel(
  sessionId: string,
  body: { number: number; total: number; reason: string },
  centerId: string
): Promise<{ id: string; before: string | null; after: string }> {
  return apiFetch(`/frontdesk/sessions/${sessionId}/legacy-label`, {
    method: "POST",
    body: JSON.stringify({ ...body, centerIds: [centerId] }),
  }, centerId);
}

export type RenumberRow = { id: string; date: string; before: string | null; after: string; changed: boolean };
export type RenumberInput = { total: number; startAt?: number; from?: string; to?: string; reason: string; preview?: boolean };

export function renumberLegacy(
  patientId: string,
  serviceId: string,
  body: RenumberInput,
  centerId: string
): Promise<{ rows: RenumberRow[] }> {
  return apiFetch(`/frontdesk/patients/${patientId}/services/${serviceId}/legacy-renumber`, {
    method: "POST",
    body: JSON.stringify({ ...body, centerIds: [centerId] }),
  }, centerId);
}
