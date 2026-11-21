// Grouping for the nursing panel's "work of the day" (cmr-be #666): rows by section, split into
// "to claim" (staffId null) and each staff member's own claimed rows. Contract:
// .personal/handoff-panel-trabajo-del-dia.md.

import type { PanelWorkRow } from "../api/paneles.ts";

export function rowsForSection(rows: readonly PanelWorkRow[], sectionKey: string): PanelWorkRow[] {
  return rows.filter((r) => r.sectionKey === sectionKey);
}

export function unclaimedRows(rows: readonly PanelWorkRow[]): PanelWorkRow[] {
  return rows.filter((r) => !r.staffId);
}

export function rowsForStaff(rows: readonly PanelWorkRow[], staffId: string): PanelWorkRow[] {
  return rows.filter((r) => r.staffId === staffId);
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
