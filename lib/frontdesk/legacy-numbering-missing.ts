// The checks of the two «legacy numbering» dialogs (rule 8: missing drives disabled, invalid is a reason).
// Pure, tested in legacy-numbering-missing.test.ts.

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

/** «Sesión n de m»: both whole numbers, 1 ≤ n ≤ m. */
export function legacyLabelCheck(f: { number: string; total: string; reason: string }) {
  const n = int(f.number);
  const m = int(f.total);
  const filled = { number: f.number.trim() !== "", total: f.total.trim() !== "", reason: f.reason.trim().length >= 3 };
  const invalid = filled.number && filled.total && (n == null || m == null || m < 1 || n < 1 || n > m);
  return { filled, invalid, number: n, total: m };
}

/** «Renumerar serie»: total ≥ 1, start ≥ 1 (default 1), optional from ≤ to. */
export function renumberCheck(f: { total: string; startAt: string; from: string; to: string; reason: string }) {
  const total = int(f.total);
  const startAt = f.startAt.trim() === "" ? 1 : int(f.startAt);
  const filled = { total: f.total.trim() !== "", reason: f.reason.trim().length >= 3 };
  const badNumbers = filled.total && (total == null || total < 1 || startAt == null || startAt < 1 || startAt > total);
  const badRange = !!f.from && !!f.to && f.from > f.to;
  return { filled, invalid: badNumbers || badRange, badRange, total, startAt };
}

/** How many rows a preview would change. */
export const changedCount = (rows: readonly { changed: boolean }[]) => rows.filter((r) => r.changed).length;
