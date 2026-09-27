// Type-only import — erased entirely by --experimental-strip-types, so Node's test runner never has to
// resolve `lib/api/resources.ts` (which pulls in apiFetch/env, incompatible with a bare Node test run —
// same reasoning the rest of this repo's pure-function tests already follow).
import type { AvailabilitySlot } from "../api/resources.ts";

// Recurring booking plan ("every N days at a given time", repeated `count` times) for ONE service.
// Never books blind: every candidate date is checked against REAL availability (the same engine the
// single-day planner already uses, via the injected `fetchAvailability`) before it's proposed. If the
// requested time doesn't fit that day, it looks for the closest time that does fit ON THAT SAME DAY; if
// NO time fits, it searches neighboring days (alternating forward/backward) until one fits. This is PURE
// CALCULATION — it never books anything; the caller decides whether to confirm the resulting plan.
// Owner's request (2026-09-26): "if a day or time doesn't fit because of patient concurrency, suggest
// another date or time or both" — don't wire the BE's bulk endpoint (agendar-multiple) blindly.

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

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Closest fitting time to the one requested, on a given day's slots. Exact match wins if it fits.
function bestTimeInDay(slots: AvailabilitySlot[], wanted: string): string | null {
  const fitting = slots.filter((s) => s.fits);
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
    everyDays: number;
    preferredTime: string;
    count: number;
    // How many days forward/backward to search for an alternate date before giving up. Default 14.
    searchWindowDays?: number;
  },
  fetchAvailability: AvailabilityLookup,
): Promise<RecurringPlanItem[]> {
  const { serviceId, centro, areas, startDate, everyDays, preferredTime, count } = params;
  const windowDays = params.searchWindowDays ?? 14;

  // Per-date availability cache, MUTATED locally as this plan reserves a slot — so two sessions in the
  // same series don't collide with each other before anything is actually saved to the BE (the BE knows
  // nothing about this plan yet; this is a purely client-side simulation).
  const cache = new Map<string, AvailabilitySlot[]>();
  async function slotsFor(date: string): Promise<AvailabilitySlot[]> {
    const hit = cache.get(date);
    if (hit) return hit;
    const avail = await fetchAvailability(date, serviceId, areas, centro);
    const slots = avail.configured ? avail.slots : [];
    cache.set(date, slots);
    return slots;
  }
  function reserve(date: string, time: string) {
    const slots = cache.get(date);
    const idx = slots?.findIndex((s) => s.time === time) ?? -1;
    if (!slots || idx === -1) return;
    const s = slots[idx];
    const free = (s.freeStations ?? (s.fits ? 1 : 0)) - 1;
    slots[idx] = { ...s, freeStations: Math.max(0, free), fits: free > 0 };
  }

  const items: RecurringPlanItem[] = [];
  for (let i = 0; i < count; i++) {
    const requestedDate = addDays(startDate, i * everyDays);
    let resolved: { date: string; time: string; status: RecurringPlanStatus } | null = null;

    const daySlots = await slotsFor(requestedDate);
    const t0 = bestTimeInDay(daySlots, preferredTime);
    if (t0) {
      resolved = { date: requestedDate, time: t0, status: t0 === preferredTime ? "asRequested" : "adjustedTime" };
    } else {
      for (let off = 1; off <= windowDays && !resolved; off++) {
        for (const cand of [addDays(requestedDate, off), addDays(requestedDate, -off)]) {
          const t = bestTimeInDay(await slotsFor(cand), preferredTime);
          if (t) {
            resolved = { date: cand, time: t, status: "adjustedDate" };
            break;
          }
        }
      }
    }

    if (resolved) {
      reserve(resolved.date, resolved.time);
      items.push({ index: i, requestedDate, date: resolved.date, time: resolved.time, status: resolved.status });
    } else {
      items.push({ index: i, requestedDate, date: requestedDate, time: preferredTime, status: "unresolved" });
    }
  }
  return items;
}
