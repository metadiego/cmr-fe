// Type-only imports: the test runner must never load app code (see recurring-plan.ts).
import type { SlotLibre } from "../../api/citas.ts";
import type { Availability } from "../../api/resources.ts";

// Availability model for the booking calendar: one shape for medical bands and service slots.
// Every time is normalised to "HH:mm" before it is compared (endpoints answer "7:00", "07:00", "07:00:00").

export type TimeWindow = "any" | "morning" | "afternoon";
export type SlotState = "open" | "full" | "unavailable";

export interface BookingSlot {
  time: string; // HH:mm
  capacity: number;
  free: number;
  state: SlotState;
  reasonKey: string | null;
}

export interface DaySlots {
  date: string;
  slots: BookingSlot[];
  /**
   * Services only: the session length (Availability.minutes). The BE counts free stations per
   * half-hour START slot, so summing them over slots counts one station once per start it could take;
   * day/window/week numbers turn that sum into sessions (see sessionCount). Absent for medical.
   */
  sessionMinutes?: number;
  /** Medical only: a band is bookable until start + bandMinutes (hourly bands), not just until start. */
  bandMinutes?: number;
  /** Today: how many times dropPastTimes removed (so "nothing left" is told from "closed"). */
  droppedPast?: number;
}

/** Service slots are half-hour starts (BE LAS_HORAS_DEL_DIA: 07:00..17:00 every 30 min). */
export const SERVICE_SLOT_MINUTES = 30;
/** Medical bands are whole hours (available-slots). */
export const MEDICAL_BAND_MINUTES = 60;

function toMinutes(t: string): number {
  const [h, m] = normalizeTime(t).split(":").map(Number);
  return h * 60 + m;
}

/**
 * Free stations summed over half-hour start slots → how many sessions actually fit (interim FE rule
 * until the BE occupies every slot a session spans): floor(Σfree × 30 / max(minutes, 30)). Medical
 * days (no sessionMinutes) come back unchanged.
 */
export function sessionCount(day: Pick<DaySlots, "sessionMinutes">, freeSum: number): number {
  if (day.sessionMinutes == null) return freeSum;
  const span = Math.max(day.sessionMinutes, SERVICE_SLOT_MINUTES);
  return Math.floor((freeSum * SERVICE_SLOT_MINUTES) / span);
}

export function normalizeTime(t: string): string {
  const [h = "0", m = "00"] = t.split(":");
  return `${h.padStart(2, "0")}:${m.slice(0, 2).padStart(2, "0")}`;
}

function byTime(a: BookingSlot, b: BookingSlot): number {
  return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
}

export function fromMedicalBands(date: string, bands: SlotLibre[]): DaySlots {
  const slots: BookingSlot[] = bands.map((b) => ({
    time: normalizeTime(b.time),
    capacity: b.capacity,
    free: b.free,
    state: b.free > 0 ? "open" : "full",
    reasonKey: null,
  }));
  return { date, slots: slots.sort(byTime), bandMinutes: MEDICAL_BAND_MINUTES };
}

// null = the service has no resource configured: the month must show "not set up", not "0 free".
// A start whose session would end after the last slot's end (closing) is unavailable, "ends after
// closing". Holiday / cut-off reasons stay unavailable; `therapies.noStaff` is a warning, not a block:
// the BE books anyway (and says noStaff when the technicians on shift are merely all busy), so it is
// "full" (overbookable), like `therapies.full`.
export function fromServiceAvailability(date: string, a: Availability): DaySlots | null {
  if (!a.configured) return null;
  const times = a.slots.map((s) => toMinutes(s.time));
  const closing = times.length ? Math.max(...times) + SERVICE_SLOT_MINUTES : null;
  const minutes = a.minutes ?? 0;
  const slots: BookingSlot[] = a.slots.map((s) => {
    const time = normalizeTime(s.time);
    const reasonKey = s.reasonKey ?? null;
    if (closing != null && minutes > 0 && toMinutes(time) + minutes > closing) {
      return { time, capacity: 0, free: 0, state: "unavailable", reasonKey: "therapies.endsAfterClosing" };
    }
    if (s.fits) {
      const free = s.freeStations ?? 1;
      return { time, capacity: Math.max(free, 1), free, state: "open", reasonKey };
    }
    if (
      reasonKey === "therapies.full" ||
      reasonKey === "therapies.noStaff" ||
      reasonKey === "therapies.overMaxPerPatient"
    ) {
      return { time, capacity: 1, free: 0, state: "full", reasonKey };
    }
    return { time, capacity: 0, free: 0, state: "unavailable", reasonKey };
  });
  return { date, slots: slots.sort(byTime), sessionMinutes: minutes };
}

export function inWindow(time: string, w: TimeWindow): boolean {
  if (w === "any") return true;
  const morning = normalizeTime(time) < "12:00";
  return w === "morning" ? morning : !morning;
}

/** Free spots in the window: medical = Σ free per band; services = sessions that fit (sessionCount). */
export function freeIn(day: DaySlots, w: TimeWindow): number {
  return sessionCount(day, day.slots.reduce((n, s) => (inWindow(s.time, w) ? n + Math.max(s.free, 0) : n), 0));
}

export function bookedIn(day: DaySlots): { booked: number; capacity: number } {
  let booked = 0;
  let capacity = 0;
  for (const s of day.slots) {
    if (s.state === "unavailable") continue;
    capacity += s.capacity;
    booked += s.capacity - s.free;
  }
  return { booked, capacity };
}

export function freeBucket(n: number): "full" | "low" | "some" | "many" {
  if (n <= 0) return "full";
  if (n <= 3) return "low";
  if (n <= 8) return "some";
  return "many";
}

export function bookedBucket(booked: number, capacity: number): 0 | 1 | 2 | 3 | 4 {
  if (capacity <= 0) return 0;
  const r = booked / capacity;
  if (r < 0.25) return 0;
  if (r < 0.5) return 1;
  if (r < 0.75) return 2;
  if (r < 0.95) return 3;
  return 4;
}

/**
 * Today's times that already passed are gone: drops slots before `nowTime` when the day is today (same
 * rule as `nextFree`: a slot at exactly `nowTime` stays). A medical band (bandMinutes) stays until its
 * end: the 09:00 band is still bookable at 09:40. Other days come back unchanged (same object).
 */
export function dropPastTimes(day: DaySlots, todayIso: string, nowTime: string): DaySlots {
  if (day.date !== todayIso) return day;
  const now = toMinutes(nowTime);
  const band = day.bandMinutes ?? 0;
  const slots = day.slots.filter((s) => {
    const start = toMinutes(s.time);
    return start >= now || (band > 0 && start + band > now);
  });
  return { ...day, slots, droppedPast: (day.droppedPast ?? 0) + day.slots.length - slots.length };
}

export function nextFree(
  days: DaySlots[],
  w: TimeWindow,
  n: number,
  from: { date: string; time?: string },
): { date: string; time: string }[] {
  const fromTime = from.time ? normalizeTime(from.time) : null;
  const out: { date: string; time: string }[] = [];
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const d of sorted) {
    if (d.date < from.date) continue;
    for (const s of d.slots) {
      if (s.free <= 0 || !inWindow(s.time, w)) continue;
      if (d.date === from.date && fromTime && s.time < fromTime) continue;
      out.push({ date: d.date, time: s.time });
      if (out.length >= n) return out;
    }
  }
  return out;
}
