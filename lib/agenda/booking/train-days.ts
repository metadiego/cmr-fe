// Type-only imports: the test runner must never load app code (see recurring-plan.ts).
import type { BookableService } from "../../api/frontdesk.ts";
import { MAX_SESSIONS } from "./series-booking.ts";

// The patient desk's therapy form books the ticked therapies on every date, but a therapy can be taken
// off one date (SÓNICA with 2 sessions left on 2 of 8 visits). The removals are kept per date, apart
// from the Citas row helpers (which rebuild rows and would drop an extra field); the BE takes each
// day's own list (book-train `serviceIds`, book-train-series `days[].serviceIds`).

/** Therapies taken off, per row date. */
export type DayOff = Readonly<Record<string, readonly string[]>>;

/** The day's therapies: the ticked ones, in tick order, minus those taken off that date. */
export function dayTherapies(selected: readonly string[], off: DayOff, date: string): string[] {
  const gone = off[date] ?? [];
  return selected.filter((id) => !gone.includes(id));
}

/** Takes `id` off `date`. The day's last therapy stays (drop the row instead): same object back. */
export function removeOff(off: DayOff, date: string, id: string, selected: readonly string[]): DayOff {
  const left = dayTherapies(selected, off, date);
  if (!left.includes(id) || left.length <= 1) return off;
  return { ...off, [date]: [...(off[date] ?? []), id] };
}

/** Puts `id` back on `date`. */
export function restoreOff(off: DayOff, date: string, id: string): DayOff {
  const rest = (off[date] ?? []).filter((x) => x !== id);
  const others = Object.fromEntries(Object.entries(off).filter(([d]) => d !== date));
  return rest.length ? { ...others, [date]: rest } : others;
}

/** A row changed date (`to`) or was dropped (`to` null): its removals follow it or go with it. */
export function moveOff(off: DayOff, from: string, to: string | null): DayOff {
  const moved = off[from];
  const others = Object.fromEntries(Object.entries(off).filter(([d]) => d !== from));
  return to && moved?.length ? { ...others, [to]: moved } : others;
}

/**
 * The first ticked therapy (tick order) booked on more days than it has sessions left, or null. A
 * therapy missing from the balance has none left; an unknown balance judges nothing.
 */
export function overCapTherapy(
  days: ReadonlyArray<readonly string[]>,
  bookable: ReadonlyMap<string, BookableService> | undefined,
  selected: readonly string[],
): { therapyId: string; used: number; left: number } | null {
  if (!bookable) return null;
  for (const id of selected) {
    const used = days.filter((d) => d.includes(id)).length;
    const left = Math.max(0, Math.floor(bookable.get(id)?.bookable ?? 0));
    if (used > left) return { therapyId: id, used, left };
  }
  return null;
}

/** How many visits may be asked for: the largest balance among the ticked (each day can drop the others), max 20. */
export function trainMaxRows(bookable: ReadonlyMap<string, BookableService> | undefined, selected: readonly string[]): number {
  if (!bookable || selected.length === 0) return MAX_SESSIONS;
  const most = Math.max(...selected.map((id) => Math.max(0, Math.floor(bookable.get(id)?.bookable ?? 0))));
  return Math.min(MAX_SESSIONS, most);
}

/** An unticked therapy is forgotten on every day: ticked again, it goes back on all of them. */
export function forgetTherapy(off: DayOff, id: string): DayOff {
  const out: Record<string, readonly string[]> = {};
  for (const [date, ids] of Object.entries(off)) {
    const rest = ids.filter((x) => x !== id);
    if (rest.length) out[date] = rest;
  }
  return out;
}
