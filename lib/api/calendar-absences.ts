// Calendar vacations / leave → available staff (BE #558, docs/specs/ausencias-del-calendario-handoff.md).
// The staff keep writing in the calendar; the screen offers a pre-filled chip accepted with one click.
// Field names read from the real v2 responses (Caguas, 11-nov).
import { apiFetch, oneCenterPath, tenantOf } from "./client";
import type { CalendarioEvento } from "./calendario";
import type { CenterChoice } from "@/lib/clinic-read-scope";

export type AbsenceKind = "vacation" | "leave";
export interface LinkedAbsence {
  id: string;
  staffId: string;
  staffName: string | null;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
}
export interface AbsenceSuggestion {
  staffId: string | null;
  staffName: string | null;
  candidates: Array<{ id: string; name: string }>;
  kind: AbsenceKind;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  confidence: "high" | "low";
  reasonKey: string | null;
}
export type EventWithAbsence = CalendarioEvento & { absence?: LinkedAbsence | null; absenceSuggestion?: AbsenceSuggestion | null };
export type ReviewRow = CalendarioEvento & { suggestion: AbsenceSuggestion | null; absenceDismissed?: boolean };

export interface LinkAbsenceBody {
  staffId: string;
  kind: AbsenceKind;
  startTime?: string;
  endTime?: string;
}

/** Accept: the event becomes that person's absence (calendario.absences in the event's center). */
export function linkEventAbsence(eventId: string, body: LinkAbsenceBody, centerId?: string | null): Promise<EventWithAbsence> {
  return apiFetch(`/calendar/events/${encodeURIComponent(eventId)}/absence`, { method: "PUT", body: JSON.stringify(body) }, centerId ?? undefined);
}
/** «No es ausencia» / remove the link: the event leaves the review list. */
export function dismissEventAbsence(eventId: string, centerId?: string | null): Promise<unknown> {
  return apiFetch(`/calendar/events/${encodeURIComponent(eventId)}/absence`, { method: "DELETE" }, centerId ?? undefined);
}

/** What a title seems to say, while typing; writes nothing. null = not an absence. */
export function suggestAbsence(
  q: { titulo: string; dia: string; diaFin?: string | null; hora?: string | null; horaFin?: string | null; centroId?: string | null },
): Promise<AbsenceSuggestion | null> {
  const sp = new URLSearchParams({ titulo: q.titulo, dia: q.dia });
  if (q.diaFin) sp.set("diaFin", q.diaFin);
  if (q.hora) sp.set("hora", q.hora);
  if (q.horaFin) sp.set("horaFin", q.horaFin);
  if (q.centroId) sp.set("centroId", q.centroId);
  return apiFetch<AbsenceSuggestion | null>(`/calendar/absences/suggestion?${sp.toString()}`, {}, q.centroId ?? undefined);
}

/** Events that look like an absence and are neither linked nor dismissed, from `desde`. */
export async function listAbsenceReview(desde: string, hasta: string | undefined, choice: CenterChoice): Promise<ReviewRow[]> {
  const sp = new URLSearchParams({ from: desde });
  if (hasta) sp.set("to", hasta);
  const rows = await apiFetch<ReviewRow[]>(await oneCenterPath(`/calendar/absences/review?${sp.toString()}`, choice), {}, tenantOf(choice));
  return Array.isArray(rows) ? rows : [];
}
