// When a booking asks for «confirmada» but the BE answers «programada», the appointment is invisible
// on the consultation board (it hides programada), so the desk books again and only the second try
// shows it. Cause (BE, 05-nov-2026): if the patient already has a live appointment on another date,
// POST /appointments RESCHEDULES it into the new date and the copy is born «programada», ignoring
// the requested status (handoff docs/specs/booking-reschedule-keeps-requested-status-handoff-be.md).
// Until the BE honours it, the FE confirms right away. Only programada → confirmada; never anything else.
export function needsConfirmAfterCreate(
  requested: string | null | undefined,
  returned: string | null | undefined,
): boolean {
  return requested === "confirmada" && returned === "programada";
}
