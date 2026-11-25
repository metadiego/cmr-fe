// Checks for the "Transfer treatment" patient-page tab, bulk form (cmr-be #710, handoff
// handoff-transferir-tratamiento-completo). Replaces lib/facturacion/treatment-transfer-missing.ts's
// single-package flow: one destination patient (itself, when only the center changes), N packages,
// one reason, one mode for all of them. Empty → missing; filled but not acceptable → the `*Invalid`
// problem (rule 8: filled-but-invalid is never "missing").

export type TransferManyField = "destination" | "clinic" | "packages" | "reason";

export function transferManyMissing(s: {
  destinationPatientId: string;
  isSelf: boolean;
  destinationClinicId: string;
  reason: string;
  checkedCount: number;
}): TransferManyField[] {
  const out: TransferManyField[] = [];
  if (!s.destinationPatientId) out.push("destination");
  if (s.isSelf && !s.destinationClinicId) out.push("clinic");
  if (s.checkedCount === 0) out.push("packages");
  if (!s.reason.trim()) out.push("reason");
  return out;
}

export function transferManyItemInvalid(sessionsText: string, pending: number): boolean {
  const n = Number(sessionsText);
  return sessionsText.trim() === "" || !Number.isFinite(n) || n <= 0 || n > pending;
}

export type TransferManyProblem = "sessionsOutOfRange" | "sameDestination";

/** Why the filled values cannot be saved, or null. Only meaningful once `transferManyMissing` is empty. */
export function transferManyInvalid(s: {
  isSelf: boolean;
  destinationClinicId: string;
  currentClinicId?: string;
  checkedItems: { sessions: string; pending: number }[];
}): TransferManyProblem | null {
  if (s.isSelf && s.destinationClinicId && s.currentClinicId && s.destinationClinicId === s.currentClinicId) {
    return "sameDestination";
  }
  if (s.checkedItems.some((it) => transferManyItemInvalid(it.sessions, it.pending))) return "sessionsOutOfRange";
  return null;
}
