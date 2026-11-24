import { ApiError } from "./types.ts";

// Hard blocks on booking/rescheduling an appointment (cmr-be #696/#697, handoff
// .personal/handoff-citas-en-curso-y-fecha-pasada.md): the visit is already live, or the date is past.
// Shown inline in the booking/reschedule form — never a generic toast.
const BLOCKING_CODES = new Set(["VISIT_IN_PROGRESS", "APPOINTMENT_DATE_IN_PAST"]);

export function citaBlockingCode(err: unknown): string | null {
  return err instanceof ApiError && BLOCKING_CODES.has(err.code) ? err.code : null;
}
