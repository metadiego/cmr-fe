// Pure logic of a format sheet filled on screen (the GLP-1 nursing sheet on the iPad). The structure
// (header fields, checklist questions) comes from the format's assembly; the values from
// GET …/answers (saved wins over suggested). Contract: docs/specs/glp1-hoja-enfermeria-ipad-contrato-be.md.

import type { Formato, FormatoArmado, FormatoCampo } from "../api/formatos.ts";
import type { AnswerValue, SheetAnswers, SheetAnswersInput, SheetNote } from "../api/format-answers.ts";

/**
 * Which format slugs are fillable on screen — generic, from GET /formats' own `fillable` flag
 * (cmr-be #665): true when the format's definition declares an answers.* origin (where saved
 * answers print). No FE-side list: callers fetch `getFormatos` once and build this set.
 */
export function fillableSlugsFrom(formatos: readonly Pick<Formato, "slug" | "fillable">[]): Set<string> {
  return new Set(formatos.filter((f) => f.fillable).map((f) => f.slug));
}

/**
 * Whether an autosave attempt should fire: something actually changed since the last save, no save
 * is already in flight (never two concurrent writes racing), and nothing client-detectable is
 * blocking it (a too-long field, a value already known to be out of range) — there is no separate
 * Guardar button any more, so a blocked attempt would just retry the same rejected payload forever.
 */
export function shouldAutosave(opts: { dirty: boolean; saving: boolean; blocked: boolean }): boolean {
  return opts.dirty && !opts.saving && !opts.blocked;
}

export function sheetPath(slug: string, sessionId: string): string {
  return `/forms/${encodeURIComponent(slug)}/${encodeURIComponent(sessionId)}`;
}

/** Limits of the PUT body (BE validation). */
export const LIMITS = { field: 500, note: 1000, additionalNotes: 4000, textArea: 4000 } as const;

/** Patient identity (name, record) and the visit's date come from the visit, never typed on the sheet. */
export function isReadOnlyField(f: Pick<FormatoCampo, "origen">): boolean {
  return !!f.origen && (f.origen.startsWith("paciente.") || f.origen === "sesion.fecha");
}

export interface SheetQuestion {
  section: number;
  group: number;
  question: number;
  text: string;
  /** Set on the first question of each group: the group band to draw above it. */
  groupTitle: string | null;
}

/** Every checklist question of the assembly, in on-paper order, by position. */
export function sheetQuestions(assembly: Pick<FormatoArmado, "sections">): SheetQuestion[] {
  const out: SheetQuestion[] = [];
  (assembly.sections ?? []).forEach((s, section) => {
    if (s.tipo !== "checklist") return;
    s.grupos.forEach((g, group) => {
      g.preguntas.forEach((p, question) => {
        out.push({ section, group, question, text: p.texto, groupTitle: question === 0 ? (g.titulo ?? null) : null });
      });
    });
  });
  return out;
}

/**
 * The free-text areas of the sheet (cmr-be #684), in on-paper order. A texto_libre section WITH a
 * `clave` is its own area, saved in `notes` under that key and labelled by its `titulo`. The FIRST
 * one WITHOUT a clave is the classic «additional notes» box (GLP-1); a format with no unkeyed
 * section gets no such box, because the BE refuses text there.
 */
export interface SheetTextAreas {
  keyed: { key: string; label: string | null }[];
  unkeyed: { label: string | null } | null;
}

export function sheetTextAreas(assembly: Pick<FormatoArmado, "sections">): SheetTextAreas {
  const out: SheetTextAreas = { keyed: [], unkeyed: null };
  for (const s of assembly.sections ?? []) {
    if (s.tipo !== "texto_libre") continue;
    const label = s.titulo?.trim().replace(/:$/, "") || null;
    if (s.clave) {
      if (!out.keyed.some((k) => k.key === s.clave)) out.keyed.push({ key: s.clave, label });
    } else if (!out.unkeyed) out.unkeyed = { label };
  }
  return out;
}

export function answerKey(q: { section?: number; group: number; question: number }, firstSection = 0): string {
  return `${q.section ?? firstSection}:${q.group}:${q.question}`;
}

export interface AnswerState {
  value: AnswerValue;
  note: string;
}

export interface SheetState {
  fields: Record<string, string>;
  answers: Record<string, AnswerState>;
  additionalNotes: string;
  /** Keyed free-text areas by section clave. */
  notes: Record<string, string>;
  nurseId: string;
  /** "YYYY-MM-DDTHH:mm", Puerto Rico wall clock (a datetime-local value). */
  recordedAt: string;
}

const PR_OFFSET = "-04:00"; // Puerto Rico has no daylight saving time.

/** Now as a datetime-local value in the clinic's timezone. */
export function nowLocalPR(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

/** An ISO instant (any offset) → datetime-local value in Puerto Rico. */
export function isoToLocalPR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : nowLocalPR(d);
}

/** datetime-local value in Puerto Rico → ISO 8601 with the clinic's offset. */
export function localPRToIso(local: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00${PR_OFFSET}` : null;
}

/** The screen's starting state: saved values win; otherwise the suggestion; otherwise empty. */
export function initialSheetState(data: SheetAnswers, firstSection: number, now: Date = new Date()): SheetState {
  const fields: Record<string, string> = {};
  for (const f of data.suggested?.fields ?? []) fields[f.key] = f.value ?? "";
  if (data.saved) for (const f of data.fields ?? []) fields[f.key] = f.value ?? "";
  const answers: Record<string, AnswerState> = {};
  for (const a of data.answers ?? []) answers[answerKey(a, firstSection)] = { value: a.value ?? null, note: a.note ?? "" };
  const notes: Record<string, string> = {};
  for (const n of data.notes ?? []) notes[n.key] = n.value ?? "";
  return {
    fields,
    answers,
    additionalNotes: data.additionalNotes ?? "",
    notes,
    nurseId: data.nurseId ?? data.suggested?.nurse?.id ?? "",
    recordedAt: isoToLocalPR(data.recordedAt) ?? nowLocalPR(now),
  };
}

/** The PUT body: the WHOLE sheet (an array sent replaces the saved one). Read-only fields are not sent. */
export function sheetPayload(
  state: SheetState,
  editableKeys: string[],
  questions: SheetQuestion[],
  areas: SheetTextAreas = { keyed: [], unkeyed: { label: null } },
): SheetAnswersInput {
  const notes: SheetNote[] = areas.keyed.map(({ key }) => ({ key, value: state.notes[key]?.trim() || null }));
  return {
    fields: editableKeys.map((key) => ({ key, value: state.fields[key]?.trim() || null })),
    answers: questions.map((q) => {
      const a = state.answers[answerKey(q)];
      const note = a?.note.trim();
      return { section: q.section, group: q.group, question: q.question, value: a?.value ?? null, ...(note ? { note } : {}) };
    }),
    // `notes` only when the format has keyed areas, so GLP-1's body stays exactly as before.
    ...(notes.length > 0 ? { notes } : {}),
    additionalNotes: areas.unkeyed ? state.additionalNotes.trim() || null : null,
    nurseId: state.nurseId || null,
    recordedAt: localPRToIso(state.recordedAt),
  };
}

/** How many questions have a Yes/No. */
export function answeredCount(state: SheetState, questions: SheetQuestion[]): number {
  return questions.filter((q) => state.answers[answerKey(q)]?.value != null).length;
}

export type SheetProblem =
  | { kind: "field"; key: string }
  | { kind: "note"; key: string }
  | { kind: "additionalNotes" }
  | { kind: "textArea"; key: string };

/** Filled but too long (a `reason`, never "missing"). */
export function sheetProblems(state: SheetState): SheetProblem[] {
  const out: SheetProblem[] = [];
  for (const [key, v] of Object.entries(state.fields)) if (v.trim().length > LIMITS.field) out.push({ kind: "field", key });
  for (const [key, a] of Object.entries(state.answers)) if (a.note.trim().length > LIMITS.note) out.push({ kind: "note", key });
  if (state.additionalNotes.trim().length > LIMITS.additionalNotes) out.push({ kind: "additionalNotes" });
  for (const [key, v] of Object.entries(state.notes)) if (v.trim().length > LIMITS.textArea) out.push({ kind: "textArea", key });
  return out;
}

// --- Write-back range (GLP-1 peso corrects the scale reading, cmr-be #659). ---

/** A number as the BE reads it: "212.4", "212,4 lb", "180lbs" → 212.4 / 180. Null when unreadable. */
export function readNumber(v: string): number | null {
  const m = v.trim().match(/^(\d+(?:[.,]\d+)?)\s*[a-zA-Z]*$/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export interface RangeProblem {
  key: string;
  min: number | null;
  max: number | null;
}

/** Filled, readable and outside the field's writeBack range (the BE would answer 400 and save nothing). */
export function writeBackProblems(
  fields: Pick<FormatoCampo, "clave" | "writeBack">[],
  values: Record<string, string>,
): RangeProblem[] {
  const out: RangeProblem[] = [];
  for (const f of fields) {
    const wb = f.writeBack;
    if (!wb) continue;
    const n = readNumber(values[f.clave] ?? "");
    if (n == null) continue;
    const min = wb.min ?? null;
    const max = wb.max ?? null;
    if ((min != null && n < min) || (max != null && n > max)) out.push({ key: f.clave, min, max });
  }
  return out;
}

/** 400 FORMAT_WRITE_BACK_OUT_OF_RANGE → which field, to show it next to that input. */
export function writeBackErrorOf(err: unknown): RangeProblem | null {
  const e = err as { code?: unknown; data?: unknown } | null;
  if (!e || e.code !== "FORMAT_WRITE_BACK_OUT_OF_RANGE") return null;
  const body = (e.data ?? {}) as Record<string, unknown>;
  const src = (body.error && typeof body.error === "object" ? body.error : body) as Record<string, unknown>;
  if (typeof src.key !== "string") return null;
  return {
    key: src.key,
    min: typeof src.min === "number" ? src.min : null,
    max: typeof src.max === "number" ? src.max : null,
  };
}
