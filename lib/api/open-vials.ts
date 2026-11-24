import { apiFetch, oneCenterPath } from "./client";

// A vial opened in the patient's name with something left (cmr-be #700, split vials such as Plaquex).
// Hand-typed: the OpenAPI does not declare this response yet. v2 names as the BE published them on
// 24-nov-2026 (the first live answer was an empty list, so they are checked again on the first remnant).
export type PatientOpenVial = {
  openVialId: string;
  number: number | null;
  productId: string;
  product: string | null;
  openedAt: string;
  /** null = no expiry after opening (the product has no `openedShelfLifeDays`). */
  openingExpiresAt: string | null;
  capacity: number | null;
  remaining: number;
  /** Expired after opening: not used for a dose, to be discarded (the BE opens a new vial). */
  expired: boolean;
  clinicId: string | null;
};

// GET /inventory/open-vials/patient/:patientId?centerIds= — permission frontdesk.read or inventory.read.
export async function listPatientOpenVials(patientId: string, centroId?: string): Promise<PatientOpenVial[]> {
  const path = await oneCenterPath(`/inventory/open-vials/patient/${encodeURIComponent(patientId)}`, centroId);
  const res = await apiFetch<PatientOpenVial[] | null>(path, {}, centroId);
  return Array.isArray(res) ? res : [];
}
