// Days an opened vial lasts (cmr-be #700, product `openedShelfLifeDays`): a whole number >= 1, or empty
// for "no limit" (null, sent explicitly so clearing it on an edit really clears it).
export function openedShelfLife(raw: string): { value: number | null; invalid: boolean } {
  const s = raw.trim();
  if (!s) return { value: null, invalid: false };
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? { value: n, invalid: false } : { value: null, invalid: true };
}
