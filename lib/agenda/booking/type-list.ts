import { addDays, weekdayOf } from "../recurring-plan.ts";
import { nextFree, type DaySlots } from "./availability.ts";

// "What are we booking?" as a searchable list: the search (accent- and case-insensitive), the groups
// (Medical, then the patient's packages, then the other services, each in its configured order) and the
// days the "next free" column scans. Pure, no app imports.

/** Lower case without accents or surrounding spaces: "Sónica " → "sonica". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Every word of the query appears in the name, in any order ("vit c" matches "Vitamina C"). */
export function matchesQuery(name: string, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldText(name);
  return words.every((w) => folded.includes(w));
}

export type TypeListGroupKey = "medical" | "packages" | "services";

export interface TypeListGroup<T> {
  key: TypeListGroupKey;
  items: T[];
}

/**
 * The list's groups after the search. Medical first, then the services the patient has package sessions
 * for (`packages`: service id → sessions left; only those with sessions left count), then the rest of the
 * services; the input order (the configured one) is kept inside each group. Without a search, Medical
 * and Services are always there (empty ones say so) and Packages only when it has rows; with a search,
 * empty groups are dropped.
 */
export function typeListGroups<T extends { id: string; name: string }>(p: {
  medical: T[];
  services: T[];
  packages: ReadonlyMap<string, number>;
  query: string;
}): TypeListGroup<T>[] {
  const hit = (x: T) => matchesQuery(x.name, p.query);
  const hasPackage = (x: T) => (p.packages.get(x.id) ?? 0) > 0;
  const groups: TypeListGroup<T>[] = [
    { key: "medical", items: p.medical.filter(hit) },
    { key: "packages", items: p.services.filter((x) => hasPackage(x) && hit(x)) },
    { key: "services", items: p.services.filter((x) => !hasPackage(x) && hit(x)) },
  ];
  const searching = foldText(p.query) !== "";
  return groups.filter((g) => g.items.length > 0 || (!searching && g.key !== "packages"));
}

/** The next `n` days from today (included) a type can be booked on: no Sundays, no holidays. */
export function scanDates(todayIso: string, holidays: string[], n: number): string[] {
  const out: string[] = [];
  // Bounded: even a year of holidays cannot make this loop forever.
  for (let d = todayIso, guard = 0; out.length < n && guard < 400; d = addDays(d, 1), guard++) {
    if (weekdayOf(d) !== 0 && !holidays.includes(d)) out.push(d);
  }
  return out;
}

/** How many bookable days the "next free" column looks ahead. */
export const NEXT_OPENING_DAYS = 14;

/**
 * A service scan gives up after this many empty bookable days in a row, but ONLY while no scanned day
 * had any bookable (open or full) time: that is what a service with nothing set up answers, and ~20 of
 * those days would otherwise cost ~280 requests. Once a day showed bookable times (a real, merely
 * fully booked schedule), the scan goes on to the full NEXT_OPENING_DAYS: a booked-out week must not
 * hide the openings after it.
 */
export const EMPTY_RUN_LIMIT = 5;

/** No free spot that day (no times, or every time full or unavailable). */
export function isEmptyDay(day: DaySlots): boolean {
  return !day.slots.some((s) => s.free > 0);
}

/** The day has some open or full time (an unconfigured-like answer has none). */
export function hasBookableTime(day: DaySlots): boolean {
  return day.slots.some((s) => s.state !== "unavailable");
}

export interface EmptyRun {
  /** Empty days in a row so far. */
  run: number;
  /** Some scanned day had an open or full time. */
  sawBookable: boolean;
}

/**
 * The scan state after one more scanned day (`day` as answered, before today's past times are
 * dropped), and whether the scan stops there. Only services stop early, and only when no day so far
 * had any open/full time; a fully booked medical week is real and the scan goes on.
 */
export function emptyRunStep(
  kind: "medical" | "service",
  prev: EmptyRun,
  day: DaySlots,
): EmptyRun & { stop: boolean } {
  const run = isEmptyDay(day) ? prev.run + 1 : 0;
  const sawBookable = prev.sawBookable || hasBookableTime(day);
  return { run, sawBookable, stop: kind === "service" && !sawBookable && run >= EMPTY_RUN_LIMIT };
}

/** The day's first time with room (in any window), today only from `from.time` on; null when none. */
export function firstOpening(day: DaySlots, from: { date: string; time?: string }): string | null {
  return nextFree([day], "any", 1, from)[0]?.time ?? null;
}
