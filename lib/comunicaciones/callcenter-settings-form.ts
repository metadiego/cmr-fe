// Pure validation for the Call Center settings form (configuration/callcenter), mirroring the BE's
// own rules (handoff from cmr-be-76, cmr-be #718): a valid HH:MM pair with start before end, weekdays
// 1-7, and a lag threshold of 5-720 minutes. Catching this client-side means a mistake shows up next
// to the field that caused it, not as a raw 400 VALIDATION_ERROR after a round trip.

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidHHMM(v: string): boolean {
  return HHMM.test(v);
}

/** Minutes since midnight, for comparing two HH:MM strings. Assumes isValidHHMM already passed. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isValidDayRange(start: string, end: string): boolean {
  return isValidHHMM(start) && isValidHHMM(end) && toMinutes(start) < toMinutes(end);
}

export const WEEKDAYS: readonly { value: number; labelKey: string }[] = [
  { value: 1, labelKey: "monday" },
  { value: 2, labelKey: "tuesday" },
  { value: 3, labelKey: "wednesday" },
  { value: 4, labelKey: "thursday" },
  { value: 5, labelKey: "friday" },
  { value: 6, labelKey: "saturday" },
  { value: 7, labelKey: "sunday" },
];

export function isValidLagAlertMinutes(n: number): boolean {
  return Number.isInteger(n) && n >= 5 && n <= 720;
}
