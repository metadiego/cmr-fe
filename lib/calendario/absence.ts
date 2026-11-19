// How a calendar absence reads and is accepted (BE #558). Pure.
import type { AbsenceSuggestion, LinkAbsenceBody } from "@/lib/api/calendar-absences";

/** The body of «Aceptar»: the suggested person (or the one picked among namesakes) and its hours. */
export function acceptBody(s: AbsenceSuggestion, pickedStaffId?: string | null): LinkAbsenceBody | null {
  const staffId = pickedStaffId || s.staffId;
  if (!staffId) return null;
  return {
    staffId,
    kind: s.kind,
    ...(s.startTime ? { startTime: s.startTime } : {}),
    ...(s.endTime ? { endTime: s.endTime } : {}),
  };
}

/** The part of the day: «llega 11:00» (away until), «se va 16:00» (away from), both, or the whole day. */
export function dayPart(a: { startTime: string | null; endTime: string | null }): { kind: "whole" | "until" | "from" | "between"; from?: string; until?: string } {
  if (a.startTime && a.endTime) return { kind: "between", from: a.startTime, until: a.endTime };
  if (a.endTime) return { kind: "until", until: a.endTime };
  if (a.startTime) return { kind: "from", from: a.startTime };
  return { kind: "whole" };
}

/** The rows «Aceptar todas las de confianza alta» accepts: high confidence with ONE person. */
export function acceptableAll<T extends { suggestion: AbsenceSuggestion | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.suggestion?.confidence === "high" && !!r.suggestion.staffId);
}
