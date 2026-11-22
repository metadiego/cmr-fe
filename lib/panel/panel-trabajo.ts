// Grouping for the nursing panel's "work of the day" (cmr-be #666/#668, VERSIÓN FINAL 21-nov):
// unclaimed records of a `selfClaim` section show under its chip in EVERY nurse's card (tap = claim
// for that nurse directly); tapping ANY chip (selfClaim or not) shows that nurse's own records of
// that section for today. Contract: .personal/handoff-panel-trabajo-del-dia.md.

import type { PanelWorkRow } from "../api/paneles.ts";

export function rowsForSection(rows: readonly PanelWorkRow[], sectionKey: string): PanelWorkRow[] {
  return rows.filter((r) => r.sectionKey === sectionKey);
}

/** Unclaimed rows of one section — the same list shown under that section's chip in every card. */
export function freeRowsForSection(rows: readonly PanelWorkRow[], sectionKey: string): PanelWorkRow[] {
  return rowsForSection(rows, sectionKey).filter((r) => !r.staffId);
}

/** One nurse's own rows in one section, for today — what her chip expands to. */
export function rowsForStaffInSection(rows: readonly PanelWorkRow[], sectionKey: string, staffId: string): PanelWorkRow[] {
  return rowsForSection(rows, sectionKey).filter((r) => r.staffId === staffId);
}

/**
 * Whether a section earns a slot (a chip) in this nurse's card: there's something free to grab
 * (shown to everyone) or she already has patients there. A section with nothing free and nothing of
 * hers is not rendered at all, not even as a zero.
 */
export function sectionVisibleForStaff(rows: readonly PanelWorkRow[], sectionKey: string, staffId: string): boolean {
  return freeRowsForSection(rows, sectionKey).length > 0 || rowsForStaffInSection(rows, sectionKey, staffId).length > 0;
}

/** The body `POST …/claim` needs: the session's or the appointment's id, whichever `kind` carries. */
export function claimPayloadFor(
  row: Pick<PanelWorkRow, "sectionKey" | "kind" | "sessionId" | "appointmentId">,
  staffId: string,
): { sectionKey: string; staffId: string; sessionId?: string; appointmentId?: string } {
  return {
    sectionKey: row.sectionKey,
    staffId,
    ...(row.kind === "session" ? { sessionId: row.sessionId ?? undefined } : { appointmentId: row.appointmentId ?? undefined }),
  };
}
