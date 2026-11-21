// Grouping for the nursing panel's "work of the day" (cmr-be #666, CORREGIDO 21-nov: no shared
// «Por tomar» queue — a section's free records are listed inline inside EVERY nurse's own card;
// tapping one there claims it for that nurse directly). Contract:
// .personal/handoff-panel-trabajo-del-dia.md.

import type { PanelWorkRow } from "../api/paneles.ts";

/** Unclaimed rows of one section — the same list shown inside every nurse's card. */
export function freeRowsForSection(rows: readonly PanelWorkRow[], sectionKey: string): PanelWorkRow[] {
  return rows.filter((r) => r.sectionKey === sectionKey && !r.staffId);
}

/** One nurse's own already-claimed rows in one section. */
export function rowsForStaffInSection(rows: readonly PanelWorkRow[], sectionKey: string, staffId: string): PanelWorkRow[] {
  return rows.filter((r) => r.sectionKey === sectionKey && r.staffId === staffId);
}

/**
 * Whether a section earns a slot in this nurse's card: there's something free to grab (shown to
 * everyone) or she already has patients there. A section with nothing free and nothing of hers is
 * just noise — it is not rendered at all, not even as a zero.
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
