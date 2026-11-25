import { resultTime, type BookingResult, type BookingResultItem } from "./booking-result.ts";

// What the printed appointment sheet lists: what was just booked or moved, plus the patient's OTHER live
// appointments (medical and service) on those same days at the same center, so a patient with several
// services on one day sees all of them. Pure: tested in sheet-items.test.ts.

/** One of the patient's appointments as read back from the BE (PatientAppointment's shape). */
export interface SameDayAppointment {
  kind: BookingResultItem["kind"];
  typeId: string;
  date: string;
  time: string | null;
  isLive: boolean;
  withLabel: string | null;
  centerId?: string | null;
}

export function sheetItems(
  result: BookingResult,
  others: readonly SameDayAppointment[],
  nameOf: (kind: SameDayAppointment["kind"], typeId: string) => string | undefined,
): BookingResultItem[] {
  const days = new Set(result.items.map((i) => i.date));
  const center = result.center.id;
  // Each booked item absorbs at most one BE row: that row IS the booked appointment.
  const unmatched = [...result.items];
  const extras: BookingResultItem[] = [];
  for (const o of others) {
    const date = o.date.slice(0, 10);
    if (!o.isLive || !days.has(date)) continue;
    if (center && o.centerId && o.centerId !== center) continue;
    const typeName = nameOf(o.kind, o.typeId);
    if (!typeName) continue; // never print a row with no name
    const time = o.time ? resultTime(o.time) : "";
    // A BE row with no time matches the booked one whatever time the result filled in for it.
    const at = unmatched.findIndex((i) => i.date === date && i.kind === o.kind && i.typeName === typeName && (!time || i.time === time));
    if (at >= 0) {
      unmatched.splice(at, 1);
      continue;
    }
    extras.push({ date, time, typeName, kind: o.kind, ...(o.kind === "medical" ? { doctor: o.withLabel } : {}) });
  }
  // By day, then time; a row with no time goes last in its day.
  const key = (i: BookingResultItem) => `${i.date} ${i.time || "99:99"}`;
  return [...result.items, ...extras].sort((a, b) => key(a).localeCompare(key(b)));
}
