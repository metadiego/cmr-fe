// Is there room for an appointment TYPE at a TIME on a day? Reads the day agenda's slots
// (GET /appointments/day-agenda → centers[0].slots[].tipos[].vacios). The BE does NOT enforce cupo on a
// reschedule, so this is a warning plus a "use the next free hour" shortcut, never a block.

export type AgendaSlot = {
  time: string | null;
  tipos: { appointmentTypeId: string; vacios: number }[];
};

export type SlotAvailability = {
  /** Free places of that type at that time (0 when the time is not a slot of the day). */
  free: number;
  /** Free places of that type across the whole day (any time, including slots without one). */
  freeDay: number;
  /** The first time with room for that type at or after the requested one (or the first of the day). */
  next: string | null;
};

// "09:30:00" and "09:30" are the same slot.
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function slotAvailability(
  slots: AgendaSlot[],
  appointmentTypeId: string,
  time: string | null | undefined,
): SlotAvailability {
  const want = hhmm(time);
  const freeOf = (s: AgendaSlot) =>
    s.tipos.find((x) => x.appointmentTypeId === appointmentTypeId)?.vacios ?? 0;
  const here = want ? slots.find((s) => hhmm(s.time) === want) : undefined;
  const next =
    slots
      .filter((s) => s.time && freeOf(s) > 0)
      .map((s) => hhmm(s.time))
      .sort()
      .find((t) => t >= want) ?? null;
  const freeDay = slots.reduce((n, s) => n + freeOf(s), 0);
  return { free: here ? freeOf(here) : 0, freeDay, next };
}
