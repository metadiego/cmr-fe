// Type-only imports: the test runner must never load app code (see recurring-plan.ts).
import type { BookableService } from "../../api/frontdesk.ts";
import type { PatientTrain } from "../../api/resources.ts";
import { isNotCancelled, type StagedRow } from "../../lifecycle/stage-groups.ts";
import { normalizeTime, type DaySlots } from "./availability.ts";
import { MAX_SESSIONS } from "./series-booking.ts";

// The patient desk books several therapies as one TRAIN (one entry time, the BE plans the legs). To book
// it with the Citas series form, each date's train plan is turned into the `DaySlots` shape that form
// already understands, so its row logic (buildSeriesRows, rowTimeOptions, fitLoadedTimes) applies as is:
// an entry time where the whole train fits is "open" with one place; one that does not fit but may be
// booked anyway (`selectable`, the BE warns) is "full", i.e. an overbook; any other is "unavailable".

export function trainDaySlots(train: PatientTrain): DaySlots {
  return {
    date: train.date,
    slots: train.slots.map((s) => {
      const state = s.fits ? "open" : s.selectable ? "full" : "unavailable";
      return { time: normalizeTime(s.time), capacity: 1, free: s.fits ? 1 : 0, state, reasonKey: s.reasonKey ?? null };
    }),
  };
}

/**
 * How many visits one booking may hold: the ticked therapy with the fewest sessions left caps it (a
 * visit books every ticked therapy), and never more than 20. A ticked therapy missing from the balance
 * has none left. Unknown balance or nothing ticked: only the 20 applies.
 */
export function trainCap(
  bookable: ReadonlyMap<string, BookableService> | undefined,
  serviceIds: readonly string[],
): { max: number; limitedBy: string | null; left: number | undefined } {
  if (!bookable || serviceIds.length === 0) return { max: MAX_SESSIONS, limitedBy: null, left: undefined };
  let left = Infinity;
  let limitedBy: string | null = null;
  for (const id of serviceIds) {
    const n = Math.max(0, Math.floor(bookable.get(id)?.bookable ?? 0));
    if (n < left) {
      left = n;
      limitedBy = id;
    }
  }
  if (left > MAX_SESSIONS) return { max: MAX_SESSIONS, limitedBy: null, left };
  return { max: left, limitedBy, left };
}

/** The order the therapies are done in: the BE's plan when it has one, else the order they were ticked. */
export function trainOrder(train: PatientTrain | null | undefined, ticked: readonly string[]): string[] {
  const legs = train?.legs.map((l) => l.serviceId).filter((id) => ticked.includes(id)) ?? [];
  return legs.length ? [...legs, ...ticked.filter((id) => !legs.includes(id))] : [...ticked];
}

/**
 * What the train plan and the booking are both asked with: the ticked therapies (in tick order, which is
 * the order «Mantener mi orden» keeps; the BE reorders by weight otherwise), their areas (ticked only,
 * 1 when untouched) and a cache key that changes exactly when the plan would.
 */
export function trainRequest(
  ticked: readonly string[],
  areas: Readonly<Record<string, number>>,
  keepOrder: boolean,
): { serviceIds: string[]; areas: Record<string, number>; key: string } {
  const serviceIds = [...ticked];
  const areaMap: Record<string, number> = {};
  for (const id of serviceIds) areaMap[id] = areas[id] ?? 1;
  const keyIds = keepOrder ? serviceIds : [...serviceIds].sort();
  const key = `${keyIds.join(",")}|${keyIds.map((id) => areaMap[id]).join(",")}|${keepOrder ? "asked" : "weight"}`;
  return { serviceIds, areas: areaMap, key };
}

/** One therapy of a day's train, as the BE planned it. */
export interface TrainLegRow {
  serviceId: string;
  start: string;
  end: string;
  minutes: number;
  /** Runs alongside the others (blocking:false, e.g. Transcraneal): it does not hold the patient. */
  parallel: boolean;
  /** Starts at the same time as another therapy (the IV chair holds two at once; one running alongside). */
  together: boolean;
}

function plusMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * How the train runs that day if the patient arrives at `time`: one entry per therapy, in the order
 * the BE planned, with its start, end and minutes, and when the patient leaves. Null when that hour is
 * not planned or has no legs. Read-only: the BE books every leg at its own planned slot.
 */
export function trainSchedule(
  train: PatientTrain | null | undefined,
  time: string,
): { legs: TrainLegRow[]; endsAt: string | null } | null {
  const t = normalizeTime(time);
  const slot = train?.slots.find((s) => normalizeTime(s.time) === t);
  if (!slot || slot.legs.length === 0) return null;
  const legs = slot.legs.map((leg) => {
    const start = normalizeTime(leg.start);
    return { serviceId: leg.serviceId, start, end: plusMinutes(start, leg.minutes), minutes: leg.minutes, parallel: leg.parallel };
  });
  const rows = legs.map((l) => ({
    ...l,
    together: !l.parallel && legs.some((o) => o !== l && o.start === l.start),
  }));
  return { legs: rows, endsAt: slot.endsAt ? normalizeTime(slot.endsAt) : null };
}

/**
 * What the patient already has that day of the ticked therapies (not cancelled), earliest first and
 * those without a time last: what a row blocked as a same-day duplicate names.
 */
export function sameDaySessions(
  sessions: ReadonlyArray<StagedRow & { serviceId: string; date: string; time: string | null; status: string }>,
  date: string,
  serviceIds: readonly string[],
): { serviceId: string; time: string | null; status: string }[] {
  const ticked = new Set(serviceIds);
  return sessions
    .filter((s) => ticked.has(s.serviceId) && isNotCancelled("therapy", s) && s.date.slice(0, 10) === date)
    .map((s) => ({ serviceId: s.serviceId, time: s.time ? normalizeTime(s.time) : null, status: s.status }))
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}
