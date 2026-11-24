// Type-only imports: the test runner must never load app code (see recurring-plan.ts).
import type { BookableService } from "../../api/frontdesk.ts";
import type { PatientTrain } from "../../api/resources.ts";
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

/** When the patient leaves if the train starts at `time` (HH:mm), or null when that time is not planned. */
export function trainEndsAt(train: PatientTrain | null | undefined, time: string): string | null {
  const t = normalizeTime(time);
  const s = train?.slots.find((x) => normalizeTime(x.time) === t);
  return s?.endsAt ? normalizeTime(s.endsAt) : null;
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

/**
 * Days the patient already has a live (not cancelled) session of a ticked therapy: the BE refuses a second
 * one that day (FRONTDESK_SESSION_SAME_DAY), so those rows are blocked up front.
 */
export function liveSessionDates(
  sessions: ReadonlyArray<{ serviceId: string; date: string; status: string }>,
  serviceIds: readonly string[],
): string[] {
  const ticked = new Set(serviceIds);
  const days = new Set<string>();
  for (const s of sessions) if (ticked.has(s.serviceId) && s.status !== "cancelada") days.add(s.date.slice(0, 10));
  return [...days].sort();
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
