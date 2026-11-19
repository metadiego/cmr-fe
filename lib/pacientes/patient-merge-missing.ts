// Checks for the «Merge with…» dialog (components/clientes/patient-merge-dialog.tsx). The reason and the
// past-counts acknowledgement only count once the simulated plan is on screen and nothing blocks it.

export type PatientMergeField = "otherRecord" | "acceptPastImpact" | "reason";
export type PatientMergeBlock = "simulating" | "simulationFailed" | "mergeBlocked";

export type PatientMergeState = {
  /** The other record has been picked. */
  hasOther: boolean;
  /** The simulation is running. */
  simulating: boolean;
  /** The simulated plan arrived. */
  hasPlan: boolean;
  /** The plan reports blocking conditions. */
  planBlocked: boolean;
  /** The plan changes past-period people counts (needs the acknowledgement). */
  needsPastAccept: boolean;
  acceptPast: boolean;
  reason: string;
};

/** Missing inputs, in on-screen order. */
export function patientMergeMissing(s: PatientMergeState): PatientMergeField[] {
  if (!s.hasOther) return ["otherRecord"];
  if (s.simulating || !s.hasPlan || s.planBlocked) return [];
  const out: PatientMergeField[] = [];
  if (s.needsPastAccept && !s.acceptPast) out.push("acceptPastImpact");
  if (!s.reason.trim()) out.push("reason");
  return out;
}

/** Why the merge cannot run although nothing is missing; null when it can. */
export function patientMergeBlock(s: PatientMergeState): PatientMergeBlock | null {
  if (!s.hasOther) return null;
  if (s.simulating) return "simulating";
  if (!s.hasPlan) return "simulationFailed";
  if (s.planBlocked) return "mergeBlocked";
  return null;
}
