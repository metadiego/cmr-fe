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
