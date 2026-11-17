// The frontdesk Consulta tab's board. cmr-be PR #557 (step 4c, released 13-nov-2026) renamed it from
// "atencion" to "frontdesk_consultation" and the appointment channel from "atencion" to "frontdesk".
// The API returns the new names and keeps accepting the old ones forever, so requests send the new
// names and anything read back is compared against both.
// Source: cmr-be docs/specs/access-control-cleanup-handoff-fe.md §4.

/** The board key sent in requests. */
export const CONSULTATION_BOARD = "frontdesk_consultation";

const CONSULTATION_BOARD_KEYS: readonly string[] = ["frontdesk_consultation", "atencion"];

/** Whether a board key returned by the API is the Consulta board (old or new name). */
export function isConsultationBoard(boardSlug: string | null | undefined): boolean {
  return !!boardSlug && CONSULTATION_BOARD_KEYS.includes(boardSlug);
}

/** The channel of an appointment booked at the front desk, as sent in requests. */
export const FRONTDESK_CHANNEL = "frontdesk";

/** Channel as the screens know it: an old "atencion" value is handled as "frontdesk". */
export function frontdeskChannel(channel: string | null | undefined): string | null | undefined {
  return channel === "atencion" ? FRONTDESK_CHANNEL : channel;
}
