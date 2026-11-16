// Check for the past-day change dialog (components/caja/past-day-confirm-host.tsx): the reason
// that goes out as `X-Change-Reason`. Whether the day may be changed at all is the BE's call.

export type PastDayField = "reason";

/** ["reason"] while the reason is blank (after trim). */
export function pastDayMissing(s: { reason: string }): PastDayField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}
