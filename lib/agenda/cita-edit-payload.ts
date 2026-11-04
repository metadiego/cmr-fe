// Editing an appointment (PUT /appointments/:id) is NOT a create: the BE's UpdateCitaDto
// (whitelist + forbidNonWhitelisted) accepts only doctorId, time, endTime, reason, notes (plus the
// vitals nurse / front-desk ids, which this form never touches). Sending the create payload
// (patientId, appointmentTypeId, date, channel, isFirstVisit…) made every edit fail with a 400.
//
// The date, the type and the patient cannot change through an edit: a new date or type is a
// reschedule (POST /appointments/:id/reschedule, with a reason). The modal locks those fields in
// edit mode; this mapping still refuses them, so a stray change is reported instead of dropped.

/** The editable fields of the update, with their v2 (English) names. `null` clears the field. */
export interface CitaEditPayload {
  doctorId?: string | null;
  time?: string;
  endTime?: string;
  reason?: string | null;
  notes?: string | null;
}

/** The appointment as loaded (only what the edit compares against). */
export interface CitaEditOriginal {
  patientId?: string | null;
  appointmentTypeId?: string | null;
  doctorId?: string | null;
  date?: string | null; // "YYYY-MM-DD" or an ISO timestamp
  time?: string | null;
  endTime?: string | null;
  reason?: string | null;
  notes?: string | null;
}

/** The modal's form state. Empty strings mean "none". */
export interface CitaEditForm {
  patientId: string;
  appointmentTypeId: string;
  doctorId: string;
  date: string; // "YYYY-MM-DD"
  time: string;
  endTime: string;
  reason: string;
  notes: string;
}

/** A field that an edit cannot change (it needs a reschedule). */
export type CitaEditLockedField = "date" | "appointmentType" | "patient";

export type CitaEditResult =
  | { kind: "ok"; payload: CitaEditPayload }
  | { kind: "locked"; fields: CitaEditLockedField[] };

const day = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : "");
const hm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : "");
const text = (s: string | null | undefined) => (s ?? "").trim();

/**
 * The PUT body for an edit: only the fields the update accepts, and only those that changed
 * (unchanged ones are left out, so the BE keeps them as they are). A cleared doctor, reason or notes
 * travels as `null` (the BE applies any defined value, null included).
 */
export function citaEditPayload(original: CitaEditOriginal, form: CitaEditForm): CitaEditResult {
  const locked: CitaEditLockedField[] = [];
  if (form.date && day(form.date) !== day(original.date)) locked.push("date");
  if (form.appointmentTypeId && form.appointmentTypeId !== (original.appointmentTypeId ?? "")) {
    locked.push("appointmentType");
  }
  if (form.patientId && form.patientId !== (original.patientId ?? "")) locked.push("patient");
  if (locked.length > 0) return { kind: "locked", fields: locked };

  const payload: CitaEditPayload = {};
  if ((form.doctorId || "") !== (original.doctorId ?? "")) payload.doctorId = form.doctorId || null;
  if (form.time && hm(form.time) !== hm(original.time)) payload.time = form.time;
  if (form.endTime && hm(form.endTime) !== hm(original.endTime)) payload.endTime = form.endTime;
  if (text(form.reason) !== text(original.reason)) payload.reason = text(form.reason) || null;
  if (text(form.notes) !== text(original.notes)) payload.notes = text(form.notes) || null;
  return { kind: "ok", payload };
}
