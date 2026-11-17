// Checks for «Delete this attachment» on a cash sheet (components/caja/cuadre-attachment-delete-button.tsx).
// The BE takes a 3–500 character reason; this only says what is empty or too short.

export type AttachmentDeleteField = "reason";
export type AttachmentDeleteProblem = "reasonTooShort";

/** The reason must have at least this many characters after trim (unchanged from before the form kit). */
export const ATTACHMENT_DELETE_REASON_MIN = 3;

/** ["reason"] while the reason is blank (after trim). */
export function attachmentDeleteMissing(s: { reason: string }): AttachmentDeleteField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}

/** A typed reason that is still too short (filled but not acceptable), or null. */
export function attachmentDeleteInvalid(s: { reason: string }): AttachmentDeleteProblem | null {
  const n = s.reason.trim().length;
  return n > 0 && n < ATTACHMENT_DELETE_REASON_MIN ? "reasonTooShort" : null;
}
