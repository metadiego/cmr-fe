// Type-only imports: the test runner must never load app code (see recurring-plan.ts).
import type { PatientTrain } from "../../api/resources.ts";
import { normalizeTime, type DaySlots } from "./availability.ts";
import type { TimeOption } from "./series-booking.ts";

// Why each arrival hour of a day's train is free, an overbooking or not bookable, from what the BE's
// plan says (fits / selectable, the therapy that blocks, every reason key), plus by how many minutes a
// train ends after closing. And the small list helpers the patient desk's therapy form needs.

function minutesOf(hhmm: string): number {
  const [h, m] = normalizeTime(hhmm).split(":").map(Number);
  return h * 60 + m;
}
function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The day's closing: the end of its last arrival slot, the way the BE derives it (`closingOf`: the end
 * of the last half hour of the day), so no closing time is written here. Null with no slots.
 */
export function closingOf(train: PatientTrain | null | undefined): string | null {
  const times = (train?.slots ?? []).map((s) => minutesOf(s.time)).sort((a, b) => a - b);
  if (times.length === 0) return null;
  // The slot length is the smallest gap between hours (a past hour may be missing from the plan).
  const gaps = times.slice(1).map((m, i) => m - times[i]).filter((g) => g > 0);
  const step = gaps.length ? Math.min(...gaps) : 30;
  return hhmm(times[times.length - 1] + step);
}

export interface SlotWhy {
  /** free = the whole train fits; overbook = may be booked anyway (the BE warns); blocked = not bookable. */
  kind: "free" | "overbook" | "blocked";
  endsAt: string | null;
  /** The therapy that does not fit, when the BE names it. */
  serviceId: string | null;
  /** Every reason the BE gives (i18n keys, e.g. therapies.full). */
  reasons: string[];
  /** Minutes past closing, when the reason is that the train ends after it. */
  lateBy: number | null;
}

/** What the plan says about arriving at `time`; null when the plan has no such hour. */
export function slotWhy(train: PatientTrain | null | undefined, time: string): SlotWhy | null {
  const t = normalizeTime(time);
  const s = train?.slots.find((x) => normalizeTime(x.time) === t);
  if (!s) return null;
  const endsAt = s.endsAt ? normalizeTime(s.endsAt) : null;
  if (s.fits) return { kind: "free", endsAt, serviceId: null, reasons: [], lateBy: null };
  const reasons = s.reasonKeys?.length ? [...s.reasonKeys] : s.reasonKey ? [s.reasonKey] : [];
  const closing = closingOf(train);
  const lateBy =
    reasons.includes("therapies.trainPastClosing") && endsAt && closing
      ? Math.max(0, minutesOf(endsAt) - minutesOf(closing))
      : null;
  return { kind: s.selectable ? "overbook" : "blocked", endsAt, serviceId: s.serviceId ?? null, reasons, lateBy };
}

/**
 * The hours of a train row's menu: like the Citas rowTimeOptions, but an hour that cannot be booked
 * stays in the list, disabled, so its reason can be read; the row's own time is always there.
 */
export function trainTimeOptions(day: DaySlots | null | undefined, current: string): TimeOption[] {
  const cur = normalizeTime(current);
  const out: TimeOption[] = (day?.slots ?? []).map((s) => ({
    time: normalizeTime(s.time),
    full: s.state === "full",
    disabled: s.state === "unavailable",
    free: Math.max(0, s.free),
  }));
  if (!out.some((o) => o.time === cur)) {
    out.push({ time: cur, full: false, disabled: true, free: 0 });
    out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }
  return out;
}

/** The free hour to offer instead of `time`: the first one from `time` on, else the last one before it. */
export function nearestFree(day: DaySlots | null | undefined, time: string): string | null {
  const t = minutesOf(time);
  const free = (day?.slots ?? []).filter((s) => s.state === "open" && s.free > 0).map((s) => normalizeTime(s.time));
  return free.find((f) => minutesOf(f) >= t) ?? free[free.length - 1] ?? null;
}

/** `list` with the entry at `from` moved to `to`; an index out of range changes nothing. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}
