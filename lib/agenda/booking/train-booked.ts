import type { BookableService } from "../../api/frontdesk.ts";
import type { PatientAppointment } from "./patient-appointments.ts";

// What the patient desk's therapy form shows next to each date: how many sessions of each therapy the
// patient will still have left once that visit is booked, and what else the patient already has that day.

/**
 * Per date, per therapy on it: the sessions left AFTER that visit, counting the visits in date order.
 * `bookable` is what the BE says can still be booked (bought − already booked), so a balance of 5 with
 * this therapy on two dates reads 4 on the first and 3 on the second. Never below 0 (over-cap is a
 * separate, blocking reason in the form). Without a balance nothing is returned.
 */
export function leftAfterEachDate(
  days: ReadonlyArray<{ date: string; serviceIds: readonly string[] }>,
  bookable: ReadonlyMap<string, BookableService> | undefined,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!bookable) return out;
  const used = new Map<string, number>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const line: Record<string, number> = {};
    for (const id of d.serviceIds) {
      const n = (used.get(id) ?? 0) + 1;
      used.set(id, n);
      line[id] = Math.max(0, Math.floor(bookable.get(id)?.bookable ?? 0) - n);
    }
    out[d.date] = line;
  }
  return out;
}

/**
 * The patient's live appointments on `date` other than the sessions of that day's therapies (those are
 * already marked on their own line as a duplicate): another therapy, a medical appointment. By time.
 */
export function otherOnDay(
  upcoming: readonly PatientAppointment[],
  date: string,
  serviceIds: readonly string[],
): PatientAppointment[] {
  const visit = new Set(serviceIds);
  return upcoming
    .filter((a) => a.isLive && a.date.slice(0, 10) === date && !(a.kind === "service" && visit.has(a.typeId)))
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}

/**
 * Per date, the therapies whose sessions ran out on earlier dates (counted in date order): they are
 * left out of that date on their own, so adding a date never repeats a therapy with nothing left. A
 * date never ends up empty this way: if every one of its therapies ran out, it keeps them all (and the
 * form's over-cap reason says so). Without a balance nothing is dropped.
 */
export function exhaustedOff(
  days: ReadonlyArray<{ date: string; serviceIds: readonly string[] }>,
  bookable: ReadonlyMap<string, BookableService> | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!bookable) return out;
  const used = new Map<string, number>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const runOut = d.serviceIds.filter((id) => (used.get(id) ?? 0) >= Math.max(0, Math.floor(bookable.get(id)?.bookable ?? 0)));
    // Every therapy of the date ran out: the date keeps them all (never empty).
    const gone = runOut.length === d.serviceIds.length ? [] : runOut;
    for (const id of d.serviceIds) if (!gone.includes(id)) used.set(id, (used.get(id) ?? 0) + 1);
    if (gone.length) out[d.date] = gone;
  }
  return out;
}
