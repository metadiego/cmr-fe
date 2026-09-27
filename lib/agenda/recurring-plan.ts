// Type-only import — erased entirely by --experimental-strip-types, so Node's test runner never has to
// resolve `lib/api/resources.ts` (which pulls in apiFetch/env, incompatible with a bare Node test run —
// same reasoning the rest of this repo's pure-function tests already follow).
import type { AvailabilitySlot } from "../api/resources.ts";

// Recurring booking plan ("these weekdays, at this time, for `count` sessions") for ONE service. Never
// books blind: every candidate date is checked against REAL availability (the same engine the single-day
// planner already uses, via the injected `fetchAvailability`) before it's proposed. If the requested time
// doesn't fit that day, it looks for the closest time that does fit ON THAT SAME DAY; if NO time fits, it
// searches FORWARD along the next occurrences of the same selected weekdays (never backward — a session
// never moves earlier than requested, so it can't land before "now"). This is PURE CALCULATION — it never
// books anything; the caller decides whether to confirm the resulting plan.
//
// Owner's requests (2026-09-26/27): (1) "if a day or time doesn't fit because of patient concurrency,
// suggest another date or time or both" — don't wire the BE's bulk endpoint (agendar-multiple) blindly.
// (2) sessions are counted in DAYS, not calendar time — 12 sessions on Mon/Wed/Fri is exactly 4 weeks;
// the weekday filter decides which days count, `count` decides how many. (3) never propose a day before
// today, or (for today itself) a time before right now.

export type RecurringPlanStatus = "asRequested" | "adjustedTime" | "adjustedDate" | "unresolved";

export interface RecurringPlanItem {
  index: number;
  requestedDate: string;
  date: string;
  time: string;
  status: RecurringPlanStatus;
}

// A single date's real availability, however the caller fetches it — same shape as `Availability` in
// lib/api/resources.ts without importing it as a runtime value.
export type AvailabilityLookup = (
  date: string,
  serviceId: string,
  areas: number,
  centro?: string,
) => Promise<{ configured: boolean; slots: AvailabilitySlot[] }>;

// "YYYY-MM-DD" + N days, in pure UTC (no local clock involved) — same convention as parseDayUTC
// (lib/format/fecha.ts): day-only arithmetic must never go through the browser's timezone.
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

// Day of week for a "YYYY-MM-DD" string: 0=Sunday .. 6=Saturday. Pure UTC, same reasoning as addDays.
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Closest fitting time to the one requested, on a given day's slots. Exact match wins if it fits.
// `minTime`, when given, drops any slot earlier than it — used to keep "today" from offering an hour
// that's already passed.
function bestTimeInDay(slots: AvailabilitySlot[], wanted: string, minTime?: string): string | null {
  let fitting = slots.filter((s) => s.fits);
  if (minTime) fitting = fitting.filter((s) => s.time >= minTime);
  if (fitting.length === 0) return null;
  const exact = fitting.find((s) => s.time === wanted);
  if (exact) return exact.time;
  const w = toMinutes(wanted);
  return [...fitting].sort((a, b) => Math.abs(toMinutes(a.time) - w) - Math.abs(toMinutes(b.time) - w))[0].time;
}

export async function buildRecurringPlan(
  params: {
    serviceId: string;
    centro?: string;
    areas: number;
    startDate: string;
    // 0=Sunday..6=Saturday — which weekdays count as a "day" of the series. Never empty (caller's job).
    weekdays: number[];
    preferredTime: string;
    count: number;
    // How many extra eligible-weekday occurrences (not raw calendar days) to try forward before giving
    // up on a candidate. Default 8 — e.g. with 1 weekday selected, up to 8 weeks out.
    searchWindowOccurrences?: number;
    // Dates (YYYY-MM-DD) this patient ALREADY has a pending session of this service on — same reason as
    // `usedDates` below: the BE dedupes by (patient, service, date), so proposing one of these would be
    // silently dropped as a duplicate. Pass the caller's own "already scheduled" data (it already has it).
    existingDates?: string[];
    // Earliest allowed time (HH:mm), applied ONLY on `startDate` itself — the caller passes "now" in the
    // clinic's timezone when startDate is today, and omits it otherwise (a future day has no such floor).
    minTimeOnStartDate?: string;
  },
  fetchAvailability: AvailabilityLookup,
): Promise<RecurringPlanItem[]> {
  const { serviceId, centro, areas, startDate, preferredTime, count } = params;
  const weekdaySet = new Set(params.weekdays);
  const windowOccurrences = params.searchWindowOccurrences ?? 8;

  const cache = new Map<string, AvailabilitySlot[]>();
  async function slotsFor(date: string): Promise<AvailabilitySlot[]> {
    const hit = cache.get(date);
    if (hit) return hit;
    const avail = await fetchAvailability(date, serviceId, areas, centro);
    const slots = avail.configured ? avail.slots : [];
    cache.set(date, slots);
    return slots;
  }
  const minTimeFor = (date: string) => (date === startDate ? params.minTimeOnStartDate : undefined);

  // The BE dedupes a booking by (patient, service, DATE) — not date+time, so it can hold only ONE
  // session per date for this series no matter which hour it's at. A date used by any item in this plan
  // is fully off the table for every other item — found live via adversarial review (2026-09-26).
  const usedDates = new Set<string>(params.existingDates ?? []);

  // Walks forward from `from` (inclusive) one calendar day at a time, yielding only dates whose weekday
  // is selected. Forward-only, by design: a session never moves earlier than its own requested date, so
  // it can never land before "now" or before another item this same walk already produced.
  function* eligibleFrom(from: string): Generator<string> {
    let cur = from;
    while (true) {
      if (weekdaySet.has(weekdayOf(cur))) yield cur;
      cur = addDays(cur, 1);
    }
  }

  const items: RecurringPlanItem[] = [];
  const requestedDates = eligibleFrom(startDate);
  for (let i = 0; i < count; i++) {
    const requestedDate = requestedDates.next().value as string;
    let resolved: { date: string; time: string; status: RecurringPlanStatus } | null = null;

    if (!usedDates.has(requestedDate)) {
      const t0 = bestTimeInDay(await slotsFor(requestedDate), preferredTime, minTimeFor(requestedDate));
      if (t0) resolved = { date: requestedDate, time: t0, status: t0 === preferredTime ? "asRequested" : "adjustedTime" };
    }
    if (!resolved) {
      const forward = eligibleFrom(addDays(requestedDate, 1));
      for (let n = 0; n < windowOccurrences && !resolved; n++) {
        const cand = forward.next().value as string;
        if (usedDates.has(cand)) continue;
        const t = bestTimeInDay(await slotsFor(cand), preferredTime, minTimeFor(cand));
        if (t) resolved = { date: cand, time: t, status: "adjustedDate" };
      }
    }

    if (resolved) {
      usedDates.add(resolved.date);
      items.push({ index: i, requestedDate, date: resolved.date, time: resolved.time, status: resolved.status });
    } else {
      items.push({ index: i, requestedDate, date: requestedDate, time: preferredTime, status: "unresolved" });
    }
  }
  return items;
}
