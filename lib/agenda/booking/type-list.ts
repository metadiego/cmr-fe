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

/** The day's first time with room (in any window), today only from `from.time` on; null when none. */
export function firstOpening(day: DaySlots, from: { date: string; time?: string }): string | null {
  return nextFree([day], "any", 1, from)[0]?.time ?? null;
}
