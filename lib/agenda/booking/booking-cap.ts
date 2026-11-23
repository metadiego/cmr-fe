import { MAX_SESSIONS } from "./series-booking.ts";

// The patient's bookable balance as a limit on the service booking form (spec
// 2026-11-23-appointments-booking-upgrades §4): bookable = bought − attended − already booked, from
// packages of any center. The form never books more rows than that, and with nothing left it does not
// book at all (billing message). Rows of one form share the service's one balance: never summed.

export interface BookingCap {
  /** Most sessions this booking may hold: min(bookable, 20). */
  max: number;
  /** The Semanal total before the user picks one. */
  defaultTotal: number;
  /** The 20-per-booking limit (not the balance) is what bounds `max`: say "Hasta 20 por vez". */
  limitedBy20: boolean;
}

/** undefined = balance not known yet (no patient, loading): only the 20 per booking applies. */
export function capFor(bookable: number | undefined): BookingCap {
  if (bookable === undefined) return { max: MAX_SESSIONS, defaultTotal: MAX_SESSIONS, limitedBy20: true };
  const left = Math.max(0, Math.floor(bookable));
  const max = Math.min(left, MAX_SESSIONS);
  return { max, defaultTotal: max, limitedBy20: left > MAX_SESSIONS };
}

/** Why `rows` sessions cannot be booked against the balance; null = they can (or it is not known yet). */
export function balanceReason(rows: number, bookable: number | undefined): "noBalance" | "overBalance" | null {
  if (bookable === undefined) return null;
  if (bookable <= 0) return "noBalance";
  return rows > bookable ? "overBalance" : null;
}

/** Names of the centers other than the booking one whose packages still have sessions to book. */
export function otherCenters(
  sources: ReadonlyArray<{ centerId: string; centerName: string; bookable: number }>,
  bookingCenter: string,
): string[] {
  return sources.filter((s) => s.centerId !== bookingCenter && s.bookable > 0).map((s) => s.centerName);
}
