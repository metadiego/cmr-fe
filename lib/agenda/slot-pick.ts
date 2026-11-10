// A full slot WARNS, it does not block (owner, 10-nov 14:01; BE #533, agenda.fullSlotPolicy 'warn'):
// with no room for capacity, staff or a sheet seat, the BE still books and returns a warning. The real
// rules keep blocking: past closing, holiday, not a start time, over the max per patient…
export const WARN_ONLY_REASONS: readonly string[] = ["therapies.full", "therapies.noStaff", "therapies.sheetFull"];

type Slot = { fits: boolean; reasonKey?: string | null };

/** Can the desk pick this slot? Yes when it fits, or when it is only full (booked with a warning). */
export function slotPickable(s: Slot): boolean {
  return s.fits || (!!s.reasonKey && WARN_ONLY_REASONS.includes(s.reasonKey));
}

/** Pickable but full: drawn amber, with its reason, and booked with a warning. */
export function slotWarns(s: Slot): boolean {
  return !s.fits && slotPickable(s);
}
