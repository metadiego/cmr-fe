// Sessions-per-unit default (cmr-be #657): if the invoice line doesn't send `sessions`, the BE
// computes quantity × product.sessionsPerUnit (GLP-1 = 4 → one purchase = 4 weekly sessions). The
// FE mirrors that default so the cashier sees it before saving, and edits it the same way.

export function defaultSessionsForLine(quantity: number, sessionsPerUnit: number | null): number | null {
  return sessionsPerUnit != null ? Math.max(1, Math.floor(quantity)) * sessionsPerUnit : null;
}

// What to actually SEND: only when the cashier touched the override field — an empty override
// means "use the BE's own default", never re-sending a value that merely happens to match it.
export function sessionsToSend(rawOverride: string): number | undefined {
  if (rawOverride.trim() === "") return undefined;
  return Math.max(0, Math.floor(Number(rawOverride) || 0));
}
