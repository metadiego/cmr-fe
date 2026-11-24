// What keeps «Agendar» grey on the patient desk's therapy form, beyond the missing «Terapias» field
// (forms kit: a missing field is `missing`, anything else is a `reason` said above the button). The
// first cause that applies wins, in the order a receptionist can act on it: permissions, the balance,
// the sessions-left cap, the start day, then the rows.

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
  rows: number;
  /** trainCap().max */
  max: number;
  /** trainCap().limitedBy: the therapy whose balance caps the visits. */
  limitedBy: string | null;
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
  | { key: "overCap"; n: number; therapyId: string | null }
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
  if (s.rows > s.max) return { key: "overCap", n: s.max, therapyId: s.limitedBy };
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
