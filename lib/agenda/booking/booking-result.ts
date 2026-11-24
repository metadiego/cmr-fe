import { patientName } from "../../pacientes/display-name.ts";

export interface BookingResultItem {
  date: string;
  time: string;
  typeName: string;
  kind: "medical" | "service";
  doctor?: string | null;
  /** The moved appointment's old day; `time` absent when it had none (the date alone is shown). */
  from?: { date: string; time?: string };
}

export interface BookingResult {
  mode: "booked" | "moved";
  patient: { name: string; record?: string | null };
  center: { name: string; phone?: string | null; address?: string | null };
  items: BookingResultItem[];
  skipped: { date: string; reason: string }[];
  warnings: string[];
}

/**
 * Sorts by date+time, dedupes identical date+time+typeName, drops skipped dates that were also created,
 * and lists a repeated skipped date + reason or warning once (the dialog keys its rows on them).
 */
export function buildBookingResult(input: BookingResult): BookingResult {
  const seen = new Set<string>();
  const items = [...input.items]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((i) => {
      const key = `${i.date}|${i.time}|${i.typeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const created = new Set(items.map((i) => i.date));
  const skippedSeen = new Set<string>();
  const skipped = input.skipped.filter((s) => {
    const key = `${s.date}|${s.reason}`;
    if (created.has(s.date) || skippedSeen.has(key)) return false;
    skippedSeen.add(key);
    return true;
  });
  return { ...input, items, skipped, warnings: [...new Set(input.warnings)] };
}

/** "09:30:00" or "9:30" → "09:30": the dialog's rows dedupe and sort on it. */
export function resultTime(time: string): string {
  const [h = "0", m = "00"] = time.split(":");
  return `${h.padStart(2, "0")}:${m.slice(0, 2).padStart(2, "0")}`;
}

/** The patient as the result names them: display name and record (none = null, never invented). */
export function resultPatient(
  p: { firstName: string; lastName: string | null; displayName?: string | null; medicalRecordNumber?: string | null },
): BookingResult["patient"] {
  return { name: patientName(p), record: p.medicalRecordNumber ?? null };
}

/** The booking center's printout header; a missing field is null (omitted), an unknown center blank. */
export function resultCenter(
  c: { name: string; phone?: string | null; address?: string | null } | undefined,
): BookingResult["center"] {
  return { name: c?.name ?? "", phone: c?.phone ?? null, address: c?.address ?? null };
}

/** What a service booking (one session or a series) created, skipped and was warned about. */
export function serviceBookingResult(input: {
  patient: BookingResult["patient"];
  center: BookingResult["center"];
  serviceName: string;
  created: { date: string; time: string }[];
  skipped: BookingResult["skipped"];
  warnings: string[];
}): BookingResult {
  return buildBookingResult({
    mode: "booked",
    patient: input.patient,
    center: input.center,
    items: input.created.map((c) => ({
      date: c.date.slice(0, 10),
      time: resultTime(c.time),
      typeName: input.serviceName,
      kind: "service",
    })),
    skipped: input.skipped,
    warnings: input.warnings,
  });
}

/**
 * What a therapy train booking (one visit or a series of visits) created: one row per leg, at the time
 * the BE booked it (the day's entry time when a session carries none).
 */
export function trainBookingResult(input: {
  patient: BookingResult["patient"];
  center: BookingResult["center"];
  sessions: ReadonlyArray<{ serviceId: string; date: string; time: string | null }>;
  serviceName: (id: string) => string;
  fallbackTime: (date: string) => string;
  warnings: string[];
}): BookingResult {
  return buildBookingResult({
    mode: "booked",
    patient: input.patient,
    center: input.center,
    items: input.sessions.map((s) => {
      const date = s.date.slice(0, 10);
      return {
        date,
        time: resultTime(s.time || input.fallbackTime(date)),
        typeName: input.serviceName(s.serviceId),
        kind: "service" as const,
      };
    }),
    skipped: [],
    warnings: input.warnings,
  });
}
