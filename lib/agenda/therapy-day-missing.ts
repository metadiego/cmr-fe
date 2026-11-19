// Checks for the «Programar citas» therapy day scheduler (components/agenda/therapy-day-scheduler.tsx).
// Mirrors what booking needs: a patient, at least one therapy and the train's entry hour. The date
// starts on today and its picker cannot be cleared, so it is only listed if it ever comes in blank.
// A slot that does not fit is NOT missing: it stays bookable with its warning.

export type TherapyDayField = "patient" | "therapies" | "date" | "hour";

/** Required fields still empty, in on-screen order (left column, then the hours panel). */
export function therapyDayMissing(s: {
  patientId: string | null | undefined;
  /** Ids of the checked therapies. */
  serviceIds: readonly string[];
  date: string;
  /** Entry hour of the train (HH:MM), "" when none is picked. */
  time: string;
}): TherapyDayField[] {
  const out: TherapyDayField[] = [];
  if (!s.patientId) out.push("patient");
  if (s.serviceIds.length === 0) out.push("therapies");
  if (!s.date.trim()) out.push("date");
  // One entry hour for the whole train: any checked therapy without it means the hour is missing.
  if (!s.time.trim()) out.push("hour");
  return out;
}
