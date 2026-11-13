// The frontdesk Consulta tab's board. cmr-be PR #557 (step 4c) renames it from "atencion" to
// "frontdesk_consultation" and the appointment channel from "atencion" to "frontdesk": after that
// release the API RETURNS the new names and keeps ACCEPTING the old ones forever.
// So: compare against both; SEND the old one, the only name the backend knows before the release.
// Source: cmr-be docs/specs/access-control-cleanup-handoff-fe.md §4.

/** The board key sent in requests (accepted before and after the backend release). */
export const CONSULTATION_BOARD = "atencion";

const CONSULTATION_BOARD_KEYS: readonly string[] = ["frontdesk_consultation", "atencion"];

/** Whether a board key returned by the API is the Consulta board (old or new name). */
export function isConsultationBoard(boardSlug: string | null | undefined): boolean {
  return !!boardSlug && CONSULTATION_BOARD_KEYS.includes(boardSlug);
}

/** The channel of an appointment booked at the front desk, as sent in requests. */
export const FRONTDESK_CHANNEL = "atencion";

/** Channel as the screens know it: the new "frontdesk" is shown and handled as "atencion". */
export function frontdeskChannel(channel: string | null | undefined): string | null | undefined {
  return channel === "frontdesk" ? FRONTDESK_CHANNEL : channel;
}
