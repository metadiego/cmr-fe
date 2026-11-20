// Pure rules of backdated inventory adjustments (cmr-be #646). Days are YYYY-MM-DD in the center's zone.

/** A day strictly before today. Empty = today (the BE treats a missing date as «now»). */
export const isPastDay = (day: string, today: string): boolean => !!day && day < today;

/** A day after today: the BE always refuses it. */
export const isFutureDay = (day: string, today: string): boolean => !!day && day > today;

/** The calendar day of an ISO instant in Puerto Rico (the centers' zone, UTC-4 without DST). */
export function dayPR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(d);
}

/** Effective and recorded fall on different days → show both («Fecha efectiva 31-oct · registrado 19-nov»). */
export function datesDiffer(effective: string | null | undefined, recorded: string | null | undefined): boolean {
  const a = dayPR(effective);
  const b = dayPR(recorded);
  return !!a && !!b && a !== b;
}

/** Why a backdated save cannot go yet (null = it can). The BE still decides; this only avoids a dead click. */
export function backdateBlock(p: {
  past: boolean;
  preview: { canBackdate: boolean; problems: Array<{ labelKey: string }> } | null;
  loading: boolean;
}): { kind: "forbidden" } | { kind: "problem"; labelKey: string } | { kind: "loading" } | null {
  if (!p.past) return null;
  if (p.loading || !p.preview) return { kind: "loading" };
  if (!p.preview.canBackdate) return { kind: "forbidden" };
  const first = p.preview.problems[0];
  return first ? { kind: "problem", labelKey: first.labelKey } : null;
}

/** The settings form: maxDays must be a whole number 0–366 (BE range). */
export function maxDaysCheck(raw: string): { filled: boolean; value: number | null; invalid: boolean } {
  const s = raw.trim();
  if (!s) return { filled: false, value: null, invalid: false };
  const n = Number(s);
  const ok = Number.isInteger(n) && n >= 0 && n <= 366;
  return { filled: true, value: ok ? n : null, invalid: !ok };
}

/** A later count's delta, whichever name the deployed BE sends (cmr-be #647: netChange, before it quantity). */
export const countMoved = (c: { netChange?: number; quantity?: number }): number => c.netChange ?? c.quantity ?? 0;
