import { buildBookingResult, resultTime, type BookingResult } from "./booking/booking-result.ts";

type When = { date: string; time: string };

/**
 * The result of creating a medical appointment (CitaModal). `moved`: the BE moved the patient's live
 * appointment instead of creating a second one (`rescheduledFromId`); `from` is that appointment's old
 * date and time, or null when it could not be read (still "moved", just without the old date).
 */
export function appointmentResult(input: {
  saved: When;
  moved: boolean;
  from?: When | null;
  typeName: string;
  doctor: string | null;
  patient: BookingResult["patient"];
  center: BookingResult["center"];
  warnings: string[];
}): BookingResult {
  const at = (w: When) => ({ date: w.date.slice(0, 10), time: resultTime(w.time) });
  return buildBookingResult({
    mode: input.moved ? "moved" : "booked",
    patient: input.patient,
    center: input.center,
    items: [
      {
        ...at(input.saved),
        typeName: input.typeName,
        kind: "medical",
        doctor: input.doctor,
        ...(input.moved && input.from ? { from: at(input.from) } : {}),
      },
    ],
    skipped: [],
    warnings: input.warnings,
  });
}
