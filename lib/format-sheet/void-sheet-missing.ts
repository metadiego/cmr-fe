// Checks of the «void a saved sheet» dialog (cmr-be #685, docs/specs/baja-de-hoja-de-formato.md).
// The BE takes a reason of 3–500 characters; empty is "missing" (it disables the button), filled but
// out of bounds is a `reason` the dialog writes above the button.

export const VOID_REASON = { min: 3, max: 500 } as const;

export type VoidReasonProblem = "tooShort" | "tooLong" | null;

/** Whether the reason has been typed at all (drives `missing`). */
export function voidReasonFilled(reason: string): boolean {
  return reason.trim().length > 0;
}

/** Filled but outside 3–500 characters, measured as the BE does (trimmed). */
export function voidReasonProblem(reason: string): VoidReasonProblem {
  const n = reason.trim().length;
  if (n === 0) return null;
  if (n < VOID_REASON.min) return "tooShort";
  if (n > VOID_REASON.max) return "tooLong";
  return null;
}
