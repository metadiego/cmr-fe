import { isCancelledRow, rowInGroups, type StagedRow } from "../../lifecycle/stage-groups.ts";

// How the booking screens read a patient's existing therapy sessions, by stage group.

/**
 * The session still holds its booking ("already booked" on the therapy day): not cancelled, not served
 * and not done. A negative read, so a status the mapping does not know keeps its slot.
 */
export function holdsTheBooking(s: StagedRow): boolean {
  return !rowInGroups("therapy", s, ["cancelled_or_not_served", "done"]);
}

/** The session was cancelled (or the patient arrived and was not served). */
export function sessionCancelled(s: StagedRow): boolean {
  return isCancelledRow("therapy", s);
}
