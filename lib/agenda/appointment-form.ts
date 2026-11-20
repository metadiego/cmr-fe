// Pure pieces of the appointment dialog (components/agenda/cita-modal.tsx): how an hour's free places
// read, moving the date a day at a time, and the one-line summary next to «Guardar».

export type SlotTone = "full" | "low" | "open";

/** At or below this many free places an hour is shown as nearly full (amber). */
export const LOW_FREE = 1;

export function slotTone(free: number): SlotTone {
  if (free <= 0) return "full";
  if (free <= LOW_FREE) return "low";
  return "open";
}

/** A calendar day (YYYY-MM-DD) moved by `days`, computed in UTC so no timezone shifts it. */
export function shiftDay(iso: string, days: number): string {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return iso;
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const hhmm = (t: string) => t.slice(0, 5);

/** "07:00–08:00"; the start alone when there is no distinct end; empty without a start. */
export function timeRange(start: string, end: string): string {
  if (!start) return "";
  if (!end || hhmm(end) === hhmm(start)) return hhmm(start);
  return `${hhmm(start)}–${hhmm(end)}`;
}

/** The known parts of the booking, joined; blanks are skipped so it never shows "· ·". */
export function bookingSummary(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(" · ");
}

/**
 * A new appointment opened with its type and time already chosen (the booking calendar) shows them as
 * a summary with «Cambiar» instead of asking for them again.
 */
export function startsWithChoiceMade(opts: { isEdit: boolean; typeId?: string; time?: string }): boolean {
  return !opts.isEdit && !!opts.typeId && !!opts.time;
}

/**
 * The clinic is not offered as a choice when the hour was picked from that clinic's availability
 * (booking calendar, day view): the hour is only known to be free there. Booking at the other clinic
 * means switching the clinic where its availability is shown, not in the dialog.
 */
export function clinicIsFixed(opts: { isEdit: boolean; givenClinic?: string; givenTime?: string }): boolean {
  return !opts.isEdit && !!opts.givenClinic && !!opts.givenTime;
}
