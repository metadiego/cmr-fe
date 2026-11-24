import { buildBookingResult, resultTime, type BookingResult } from "./booking/booking-result.ts";

type When = { date: string; time: string };
/** An appointment's old day: the BE may hold a date without a time. */
type From = { date: string; time?: string | null };

/**
 * The result of creating a medical appointment (CitaModal). `moved`: the BE moved the patient's live
 * appointment instead of creating a second one (`rescheduledFromId`); `from` is that appointment's old
 * date and time (time absent = the date alone), or null when it could not be read (still "moved",
 * just without the old date). The type named is the one SAVED (`savedTypeId` in `types`): on save the BE
 * may flip first visit / follow-up; `typeName` (the form's) is the fallback when it is not found.
 */
export function appointmentResult(input: {
  saved: When;
  moved: boolean;
  from?: From | null;
  typeName: string;
  savedTypeId?: string | null;
  types?: ReadonlyArray<{ id: string; name: string }>;
  doctor: string | null;
  patient: BookingResult["patient"];
  center: BookingResult["center"];
  warnings: string[];
}): BookingResult {
  const at = (w: When) => ({ date: w.date.slice(0, 10), time: resultTime(w.time) });
  const fromAt = (w: From) => ({ date: w.date.slice(0, 10), ...(w.time ? { time: resultTime(w.time) } : {}) });
  const savedType = input.savedTypeId ? input.types?.find((x) => x.id === input.savedTypeId) : undefined;
  return buildBookingResult({
    mode: input.moved ? "moved" : "booked",
    patient: input.patient,
    center: input.center,
    items: [
      {
        ...at(input.saved),
        typeName: savedType?.name ?? input.typeName,
        kind: "medical",
        doctor: input.doctor,
        ...(input.moved && input.from ? { from: fromAt(input.from) } : {}),
      },
    ],
    skipped: [],
    warnings: input.warnings,
  });
}
