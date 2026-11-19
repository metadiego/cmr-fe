// Checks for the "Transfer treatment" patient-page tab (components/clientes/ficha-transferir-tratamiento.tsx).
// Generalizes lib/frontdesk/transfer-treatment-missing.ts (center-only) with a destination PATIENT:
// not unified into that file because it backs the existing frontdesk cell dialog, which this screen
// does not touch. Empty → missing; filled but not acceptable → `treatmentTransferInvalid`.

export type TreatmentTransferState = {
  /** The source package id ("" = not chosen). */
  packageId: string;
  /** Pending sessions of the chosen package (0 when none is chosen). */
  pending: number;
  /** Destination patient id ("" = the same patient). */
  destinationPatientId: string;
  /** Destination center id ("" = the same center). */
  destinationClinicId: string;
  /** Sessions typed; empty means "all pending" (optional field). */
  sessions: string;
  /** Required only when destinationPatientId is set (the BE's own rule). */
  reason: string;
};

export type TreatmentTransferField = "package" | "destination" | "reason";

export type TreatmentTransferProblem = "nothingPending" | "sessionsOutOfRange";

/** Empty required fields, in on-screen order. Neither destination picked counts as "destination"
 *  missing — the BE would otherwise answer TRANSFER_NOTHING_CHANGES, so this keeps that unreachable. */
export function treatmentTransferMissing(s: TreatmentTransferState): TreatmentTransferField[] {
  const out: TreatmentTransferField[] = [];
  if (!s.packageId) out.push("package");
  if (!s.destinationPatientId && !s.destinationClinicId) out.push("destination");
  if (s.destinationPatientId && !s.reason.trim()) out.push("reason");
  return out;
}

/** Why the filled values cannot be saved, or null. */
export function treatmentTransferInvalid(s: TreatmentTransferState): TreatmentTransferProblem | null {
  if (s.packageId && s.pending <= 0) return "nothingPending";
  if (s.sessions.trim() === "") return null;
  const n = Number(s.sessions);
  return !Number.isFinite(n) || n <= 0 || n > s.pending ? "sessionsOutOfRange" : null;
}
