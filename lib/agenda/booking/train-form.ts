import { addDays, weekdayOf } from "../recurring-plan.ts";

// What keeps «Agendar» grey on the patient desk's therapy form, beyond the missing «Terapias» field
// (forms kit: a missing field is `missing`, anything else is a `reason` said above the button). The
// first cause that applies wins, in the order a receptionist can act on it: permissions, the balance,
// a therapy over its sessions left, the start day, then the rows.

export interface TrainFormState {
  permsReady: boolean;
  canBook: boolean;
  /** The services or resources catalogue failed to load: nothing can be listed or planned. */
  catalogueFailed: boolean;
  /** No `frontdesk.read`: the balance is never read. */
  balanceHidden: boolean;
  balanceState: "idle" | "loading" | "ok" | "fail";
  /** How many therapies are ticked. */
  ticked: number;
  /** overCapTherapy(): a therapy booked on more days than it has sessions left. */
  overCap: { therapyId: string; used: number; left: number } | null;
  startsSunday: boolean;
  /** Every row's plan, the existing sessions and the holidays have answered. */
  rowsLoaded: boolean;
  rowsFailed: boolean;
  /** A row is blocked (holiday, closed, already has a ticked therapy that day). */
  rowsBlocked: boolean;
}

export type TrainFormReason =
  | { key: "loading" }
  | { key: "noPermission" }
  | { key: "catalogueFailed" }
  | { key: "balanceHidden" }
  | { key: "balanceFailed" }
  | { key: "checking" }
  | { key: "overCap"; therapyId: string; used: number; left: number }
  | { key: "dateSunday" }
  | { key: "checkFailed" }
  | { key: "fixRed" };

export function trainFormReason(s: TrainFormState): TrainFormReason | null {
  if (!s.permsReady) return { key: "loading" };
  if (!s.canBook) return { key: "noPermission" };
  if (s.catalogueFailed) return { key: "catalogueFailed" };
  if (s.balanceHidden) return { key: "balanceHidden" };
  if (s.balanceState === "fail") return { key: "balanceFailed" };
  if (s.balanceState !== "ok") return { key: "checking" };
  if (s.ticked === 0) return null;
  if (s.overCap) return { key: "overCap", ...s.overCap };
  if (s.startsSunday) return { key: "dateSunday" };
  if (!s.rowsLoaded) return { key: "checking" };
  if (s.rowsFailed) return { key: "checkFailed" };
  if (s.rowsBlocked) return { key: "fixRed" };
  return null;
}

/**
 * The key the hand-edited rows are kept under: the mode, the weekdays and the total the user CHOSE. The
 * cap (sessions left of the ticked therapies) is not in it, so ticking a therapy with fewer sessions keeps
 * the rows and says they are too many, instead of quietly dropping some.
 */
export function seriesKey(mode: "manual" | "weekly", days: readonly number[], totalChoice: number | null): string {
  return mode === "weekly" ? `weekly|${days.join(",")}|${totalChoice ?? "auto"}` : "manual";
}

/**
 * Another train (therapies, areas, order, or a therapy taken off one `date`) changes the rows' hours.
 * Hand-edited rows are re-fitted (each keeps its time where the new train still fits, else takes that
 * day's first fitting time); generated rows fit on their own and are left alone (null = store
 * nothing), since storing them would freeze them as edits at whatever count they had.
 */
export function refitRows<T extends { date: string; fitTime?: boolean }>(edited: boolean, items: T[], date?: string): T[] | null {
  if (!edited) return null;
  return items.map((i) => (date === undefined || i.date === date ? { ...i, fitTime: true } : i));
}

/**
 * The first visit's date: the day the desk is showing when it is still to come, else tomorrow (a visit
 * is booked ahead; today is mostly gone by then), a Sunday moving to Monday since the clinic is closed.
 */
export function firstVisitDate(deskDate: string, today: string): string {
  if (deskDate > today) return deskDate;
  const tomorrow = addDays(today, 1);
  return weekdayOf(tomorrow) === 0 ? addDays(tomorrow, 1) : tomorrow;
}
