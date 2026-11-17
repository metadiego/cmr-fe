// Checks for «Acknowledge correction» on a signed cash sheet whose figures changed
// (components/caja/cash-sign-off.tsx, CashSignOffPanel). Only the reason is asked for.

export type AcknowledgeField = "reason";
export type AcknowledgeProblem = "reasonTooShort";

/** The reason must have at least this many characters after trim (unchanged from before the form kit). */
export const ACKNOWLEDGE_REASON_MIN = 3;

/** ["reason"] while the reason is blank (after trim). */
export function acknowledgeMissing(s: { reason: string }): AcknowledgeField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}

/** A typed reason that is still too short (filled but not acceptable), or null. */
export function acknowledgeInvalid(s: { reason: string }): AcknowledgeProblem | null {
  const n = s.reason.trim().length;
  return n > 0 && n < ACKNOWLEDGE_REASON_MIN ? "reasonTooShort" : null;
}
