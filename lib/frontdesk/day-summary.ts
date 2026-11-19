// The day's summary of ONE service on the patient desk (owner 18-nov-2026: the nurses print the vitamin C
// sheet to reconcile the vials). Pure helpers, tested in day-summary.test.ts; the data comes from
// GET /frontdesk/summary-of-day (cmr-be #632, handoff docs/specs/resumen-del-dia-por-servicio-handoff.md).

import { toggleColumn, visibleColumns } from "./report-columns.ts";

export const DAY_SUMMARY_COLUMNS = [
  "record",
  "patient",
  "quantity",
  "dose",
  "nurse",
  "attendedBy",
  "time",
  "sealedVials",
  "content",
] as const;
export type DaySummaryColumn = (typeof DAY_SUMMARY_COLUMNS)[number];

/** What a user sees until they choose: the eight columns of the handoff (content is opt-in). */
export const DEFAULT_DAY_SUMMARY_COLUMNS: readonly DaySummaryColumn[] = DAY_SUMMARY_COLUMNS.filter((c) => c !== "content");

/** The preference key in the user's layer of /me/preferences: `{ reportColumns: { [report]: string[] } }`. */
export const DAY_SUMMARY_REPORT = "frontdesk-day-summary";

/** The saved choice, cleaned: only known columns, always in table order; nothing valid → the defaults. */
export function visibleDaySummaryColumns(saved: unknown): DaySummaryColumn[] {
  return visibleColumns(DAY_SUMMARY_COLUMNS, DEFAULT_DAY_SUMMARY_COLUMNS, saved);
}

/** Toggle one column; the last visible one cannot be hidden (an empty table prints nothing). */
export function toggleDaySummaryColumn(current: readonly DaySummaryColumn[], col: DaySummaryColumn): DaySummaryColumn[] {
  return toggleColumn(DAY_SUMMARY_COLUMNS, current, col);
}

/** The services menu shows «arrived/attended»: the summary opens only when every arrival is attended (x/x). */
export function isServiceDayComplete(s: { arrived: number; attended: number }): boolean {
  return s.arrived > 0 && s.attended >= s.arrived;
}

/** The user's preference layer with this report's columns merged in (the PUT replaces the whole layer). */
export function withReportColumns<T extends Record<string, unknown>>(
  layer: T | null | undefined,
  report: string,
  cols: readonly string[]
): T & { reportColumns: Record<string, string[]> } {
  const base = { ...(layer ?? {}) } as T;
  const prev = base.reportColumns;
  const reportColumns = { ...(prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, string[]>) : {}), [report]: [...cols] };
  return { ...base, reportColumns };
}

/** The saved columns of one report out of the user's layer (unknown shape until read). */
export function savedReportColumns(layer: unknown, report: string): unknown {
  if (!layer || typeof layer !== "object") return undefined;
  const rc = (layer as { reportColumns?: unknown }).reportColumns;
  return rc && typeof rc === "object" ? (rc as Record<string, unknown>)[report] : undefined;
}

/** The export endpoint answers the file in base64 (download channel). */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** One to twenty comma-separated addresses, like the BE's own check (exigirDestinatarios). */
export function validEmailList(s: string): boolean {
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.length <= 20 && parts.every((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
}

export type DaySummaryGroup = { name: string | null; sessions: number; sealedVials: number; content: number };

/** Sessions, vials and content per nurse or per who marked it attended (owner 18-nov-2026: «contabilizar
 *  por enfermera y por usuario»). Most sessions first, then by name; a missing name is its own group, last. */
export function groupDaySummary<R extends { sealedVials: number; content: number }>(rows: readonly R[], key: (r: R) => string | null): DaySummaryGroup[] {
  const map = new Map<string | null, DaySummaryGroup>();
  for (const r of rows) {
    const name = key(r)?.trim() || null;
    const g = map.get(name) ?? { name, sessions: 0, sealedVials: 0, content: 0 };
    g.sessions += 1;
    g.sealedVials = Math.round((g.sealedVials + r.sealedVials) * 100) / 100;
    g.content = Math.round((g.content + r.content) * 100) / 100;
    map.set(name, g);
  }
  return [...map.values()].sort((a, b) =>
    a.name == null ? 1 : b.name == null ? -1 : b.sessions - a.sessions || a.name.localeCompare(b.name)
  );
}

/** The house domain is long (owner 18-nov-2026: «el dominio debe cargar solo»): a bare name gets the
 *  sender's own domain, so «gerencia» → «gerencia@<domain>». Full addresses pass unchanged. */
export function completeEmailList(s: string, domain: string | null): string {
  return s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.includes("@") || !domain ? p : `${p}@${domain}`))
    .join(", ");
}

/** The domain of an address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  return email && at > 0 && at < email.length - 1 ? email.slice(at + 1).toLowerCase() : null;
}
