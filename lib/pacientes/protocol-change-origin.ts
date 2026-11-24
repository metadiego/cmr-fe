// Pure helpers of the protocol change's step 1 (which pending packages are replaced), owner's drill of
// 24-nov-2026 (docs/specs/cambio-de-protocolo-areas-y-reintegro.md).

/** «N áreas por sesión · X áreas pendientes»: X = pending sessions × areas per session. Null when unknown. */
export function pendingAreas(p: { pendiente?: number | null; areasPerSession?: number | null }): { perSession: number; pending: number } | null {
  const per = p.areasPerSession;
  if (per == null || !Number.isFinite(per) || per <= 0) return null;
  return { perSession: per, pending: Math.max(0, p.pendiente ?? 0) * per };
}

/**
 * Sealed units that come back, per package id, after (un)ticking a package. Ticking prefills the whole
 * pending count unless something was already typed there; unticking clears it, so a package that is no
 * longer replaced never sends units back.
 */
export function toggleSealedUnits(
  current: Readonly<Record<string, string>>,
  packageId: string,
  checked: boolean,
  pending: number | null | undefined,
): Record<string, string> {
  const next = { ...current };
  if (!checked) {
    delete next[packageId];
    return next;
  }
  if ((next[packageId] ?? "").trim() === "") next[packageId] = String(Math.max(0, pending ?? 0));
  return next;
}
