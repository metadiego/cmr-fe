/** True when a dialog form must reset its fields: it just opened, or it stays open for a different record. */
export function shouldReset(
  prev: { open: boolean; key: unknown },
  next: { open: boolean; key: unknown },
): boolean {
  if (!next.open) return false;
  return !prev.open || !Object.is(prev.key, next.key);
}
