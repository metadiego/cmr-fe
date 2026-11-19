// How a change-log entry reads on screen (pure). Keys of before/after are the session's columns as the
// table stores them (estado, presenteEn, productoAplicadoId…), the same in v1 and v2.
import type { ChangeLogEntry } from "@/lib/api/change-log";

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
  /** BE #534: the display name next to an id (enfermeraId → enfermeraNombre); null = show the id. */
  beforeName?: string | null;
  afterName?: string | null;
}

/** The key that carries an id's display name: `enfermeraId` → `enfermeraNombre`, `productoAplicadoId` → `productoNombre`. */
export function nameKey(field: string): string | null {
  if (field === "productoAplicadoId") return "productoNombre";
  return /Id$/.test(field) ? field.replace(/Id$/, "Nombre") : null;
}

/** One line per field the click changed, in the BE's order; a field with no before/after is skipped. */
export function fieldChanges(e: Pick<ChangeLogEntry, "changeSet">): FieldChange[] {
  const { fields = [], before, after } = e.changeSet ?? { fields: [], before: null, after: null };
  return fields
    .map((field) => {
      const nk = nameKey(field);
      const nameOf = (o: Record<string, unknown> | null | undefined) => (nk && typeof o?.[nk] === "string" ? (o[nk] as string) : null);
      return { field, before: before?.[field] ?? null, after: after?.[field] ?? null, beforeName: nameOf(before), afterName: nameOf(after) };
    })
    .filter((c) => c.before !== null || c.after !== null);
}

/** The patient's name and record from the entry or its before/after snapshot (`paciente { nombre, record }`). */
export function entryPatient(e: Pick<ChangeLogEntry, "patient" | "changeSet">): { name: string | null; record: string | null } {
  const snap = (e.changeSet?.after?.paciente ?? e.changeSet?.before?.paciente ?? null) as { nombre?: string; record?: string } | null;
  const name = e.patient?.name ?? e.patient?.nombre ?? snap?.nombre ?? null;
  const record = e.patient?.record ?? snap?.record ?? null;
  return { name: name || null, record: record || null };
}

/** Undo is offered on an entry not yet undone that is not itself an undo, and only with the permission. */
export function canUndo(e: Pick<ChangeLogEntry, "undoneAt" | "undoesEntryId">, hasPermission: boolean): boolean {
  return hasPermission && !e.undoneAt && !e.undoesEntryId;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
// A stamp (presenteEn, asistidoEn…) is an instant in UTC: shown as the center's 24-hour clock. Digits only,
// so the pinned locale carries no language (CLAUDE.md rule 3b).
const CLOCK = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Puerto_Rico" });
/**
 * A before/after value as text: ids are resolved by the caller (`names`), timestamps show the center's clock,
 * objects (datos) are compacted. Empty → «—».
 */
export function valueText(v: unknown, names?: (id: string) => string | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") {
    const n = names?.(v);
    if (n) return n;
    if (ISO.test(v)) return CLOCK.format(new Date(v));
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
