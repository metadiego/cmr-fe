// Reopen a cancelled session the same day, cancel / reopen a patient's whole day (BE #508, handoff
// docs/specs/reabrir-sesion-el-mismo-dia-handoff.md). Pure rules the row menu and the boards share; the
// BE enforces every one of them again (409), these only decide what the screen offers.

/** A session date ("YYYY-MM-DD", or an ISO instant) falls on `today` ("YYYY-MM-DD"). */
export function isSessionToday(date: string | null | undefined, today: string): boolean {
  return typeof date === "string" && date.slice(0, 10) === today;
}

/** «Reabrir» is offered only on a cancelled session of TODAY; another day is never offered. */
export function canReopen(status: string, date: string | null | undefined, today: string): boolean {
  return status === "cancelada" && isSessionToday(date, today);
}

/**
 * Hide a row under «hide cancelled»? Only cancelled rows of OTHER days: today's stay visible (dimmed,
 * sorted last) so they can be reopened without filtering by the «Cancelada» KPI.
 */
export function hideCancelledRow(status: string, date: string | null | undefined, today: string): boolean {
  return status === "cancelada" && !isSessionToday(date, today);
}

/**
 * Data-driven menu actions that would duplicate «Reabrir»: transitions that start ONLY from 'cancelada'
 * (today: `reactivar`, which the BE now routes through the same rule). Hidden while «Reabrir» shows.
 */
export function duplicatesReopen(fromStatuses: readonly string[] | null | undefined): boolean {
  const from = fromStatuses ?? [];
  return from.length > 0 && from.every((s) => s === "cancelada");
}

// The BE codes a reopen can answer with, and the message key each one shows.
export const REOPEN_ERROR_KEYS: Readonly<Record<string, string>> = {
  FRONTDESK_REOPEN_ONLY_TODAY: "frontdesk.error.reopenOnlyToday",
  FRONTDESK_REOPEN_PACKAGE_CLOSED: "frontdesk.error.reopenPackageClosed",
  FRONTDESK_REOPEN_NOT_CANCELLED: "frontdesk.error.reopenNotCancelled",
  FRONTDESK_SESSION_SAME_DAY: "frontdesk.error.sessionSameDay",
  SHEET_SLOT_TAKEN: "frontdesk.error.sheetSlotTaken",
};

export interface SkippedReopen {
  id: string;
  code: string;
}

/**
 * «Reabrir todas» skipped some: one entry per distinct reason, with how many and the key to translate.
 * An unknown code keeps the code itself (key null) so it is never swallowed.
 */
export function skippedReasons(skipped: readonly SkippedReopen[] | null | undefined): Array<{ code: string; key: string | null; n: number }> {
  const byCode = new Map<string, number>();
  for (const s of skipped ?? []) byCode.set(s.code, (byCode.get(s.code) ?? 0) + 1);
  return [...byCode].map(([code, n]) => ({ code, key: REOPEN_ERROR_KEYS[code] ?? null, n }));
}
