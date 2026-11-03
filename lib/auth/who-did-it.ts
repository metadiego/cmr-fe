// "Who did it" is the PERSON: the BE stores the staff id (staff.id) in every author/actor field
// (invoices, payments, cash reconciliations and their cashier roster, calendar events, …). The
// login id (`me.id`) and the profile id (`me.profileId`) never appear there.
// See docs/specs/who-did-it-is-the-staff-id.md.
type WithStaff = { staffId?: string | null } | null | undefined;

/** The id to compare "who did it" fields against: my staff record, or null if I have none. */
export function myStaffId(me: WithStaff): string | null {
  return me?.staffId ?? null;
}

/** Whether a row's author/actor ("who did it") is me. */
export function isMine(who: string | null | undefined, me: WithStaff): boolean {
  const mine = myStaffId(me);
  return !!who && !!mine && who === mine;
}
