// Pure helpers of the daily kardex screen (app/(app)/inventory/kardex). Tested in kardex.test.ts.

/** The period the screen opens on: the 1st of the current month through today (both YYYY-MM-DD). */
export function defaultKardexRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** «3/10» when the movement belongs to a session plan; null otherwise. */
export function sessionLabel(n: number | null | undefined, total: number | null | undefined): string | null {
  return n != null && total != null ? `${n}/${total}` : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A document reference worth printing (a transfer number), not an internal UUID. */
export function readableDocument(id: string | null | undefined): string | null {
  const v = id?.trim();
  return v && !UUID.test(v) ? v : null;
}

/** A range is usable when both ends are days and from ≤ to. */
export function validRange(from: string, to: string): boolean {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  return day.test(from) && day.test(to) && from <= to;
}

/** The owner's sheet arithmetic: opening + Σinbound − Σmanual − appliedNet + correctionsNet. */
export function ownerClosing(f: {
  opening: number;
  inbound: { quantity: number }[];
  manualOutputs: { quantity: number }[];
  appliedNet: number;
  correctionsNet: number;
}): number {
  const sum = (xs: { quantity: number }[]) => xs.reduce((a, x) => a + (Number(x.quantity) || 0), 0);
  return f.opening + sum(f.inbound) - Math.abs(sum(f.manualOutputs)) - f.appliedNet + f.correctionsNet;
}
