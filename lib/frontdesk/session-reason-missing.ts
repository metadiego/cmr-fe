// Check for the row menu's cancel / cancel-all / repair dialogs (components/frontdesk/row-menu.tsx):
// each needs a reason; the new status of a repair is optional.

export type SessionReasonField = "reason";

/** ["reason"] while the reason is blank. */
export function sessionReasonMissing(s: { reason: string }): SessionReasonField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}
