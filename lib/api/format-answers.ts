import { apiFetch } from "./client";

// A format sheet filled on screen (the GLP-1 nursing sheet on the iPad) and saved per visit.
// Contract: docs/specs/glp1-hoja-enfermeria-ipad-contrato-be.md (cmr-be #658). Generic by format slug:
// which fields and questions exist is data of the format (its assembly), not of this file.

export type AnswerValue = "yes" | "no" | null;

/** A header field by the FORMAT's own key (`peso`, `ta`, `medicamento`…): the key travels as a value. */
export interface SheetField {
  key: string;
  value: string | null;
}

/** One checklist question by position: assembly.sections[section].grupos[group].preguntas[question]. */
export interface SheetAnswer {
  section?: number;
  group: number;
  question: number;
  value: AnswerValue;
  note?: string | null;
}

export interface SheetPerson {
  id: string;
  name: string;
}

export interface SheetPatient extends SheetPerson {
  medicalRecordNumber: string | null;
}

export interface SheetAnswers {
  formatSlug: string;
  sessionId: string;
  clinicId: string;
  clinicName: string | null;
  saved: boolean;
  fields: SheetField[];
  answers: SheetAnswer[];
  additionalNotes: string | null;
  nurseId: string | null;
  recordedAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  /** Pre-fill, always present: saved values win over these. */
  suggested: {
    fields: SheetField[];
    patient: SheetPatient | null;
    date: string | null;
    nurse: SheetPerson | null;
  };
}

export interface SheetAnswersInput {
  fields: SheetField[];
  answers: SheetAnswer[];
  additionalNotes: string | null;
  nurseId: string | null;
  recordedAt: string | null;
}

/** A visit of the day for the sheet's home list. */
export interface SheetSession {
  sessionId: string;
  clinicId: string;
  clinicName: string | null;
  date: string;
  time: string | null;
  /** Frontdesk state, still Spanish values (pendiente|presente|en_terapia|asistido). */
  status: string | null;
  patient: SheetPatient | null;
  nurse: SheetPerson | null;
  sheetSaved: boolean;
  savedAt: string | null;
}

const base = (slug: string) => `/formats/${encodeURIComponent(slug)}/sessions`;

/** GET …/answers — always 200: `saved` says whether there is a sheet; `suggested` pre-fills it. */
export function getSheetAnswers(slug: string, sessionId: string, centerId?: string): Promise<SheetAnswers> {
  return apiFetch<SheetAnswers>(`${base(slug)}/${encodeURIComponent(sessionId)}/answers`, {}, centerId);
}

/** PUT …/answers — the whole sheet every time (an array sent replaces the saved one). */
export function saveSheetAnswers(
  slug: string,
  sessionId: string,
  input: SheetAnswersInput,
  centerId?: string,
): Promise<SheetAnswers> {
  return apiFetch<SheetAnswers>(
    `${base(slug)}/${encodeURIComponent(sessionId)}/answers`,
    { method: "PUT", body: JSON.stringify(input) },
    centerId,
  );
}

/** GET …/sessions?date= — the day's visits of the format's service, with whether the sheet is saved. */
export function listSheetSessions(slug: string, date: string, centerId?: string): Promise<SheetSession[]> {
  return apiFetch<SheetSession[]>(`${base(slug)}?date=${encodeURIComponent(date)}`, {}, centerId);
}

/** POST …/send — opens the sheet on the iPad where `toUserId` (a staff id) is signed in. */
export function sendSheetToUser(slug: string, sessionId: string, toUserId: string, centerId?: string): Promise<unknown> {
  return apiFetch<unknown>(
    `${base(slug)}/${encodeURIComponent(sessionId)}/send`,
    { method: "POST", body: JSON.stringify({ toUserId }) },
    centerId,
  );
}
