// Checks for the "Fix sessions (no package)" dialog (components/frontdesk/sesiones-cell.tsx).
// Empty → missing; filled but not acceptable → `fixSessionsWithoutPackageInvalid`.

export type FixSessionsWithoutPackageState = {
  /** Total sessions typed. */
  sessions: string;
  /** The service bills through a group with no product of its own: a product must be chosen. */
  needsProduct: boolean;
  productId: string;
};

export type FixSessionsWithoutPackageField = "sessions" | "product";

/** Empty required fields, in on-screen order. */
export function fixSessionsWithoutPackageMissing(s: FixSessionsWithoutPackageState): FixSessionsWithoutPackageField[] {
  const out: FixSessionsWithoutPackageField[] = [];
  if (s.sessions.trim() === "") out.push("sessions");
  if (s.needsProduct && !s.productId) out.push("product");
  return out;
}

/** "sessionsNegative" when the typed total is not a number ≥ 0; empty is left to the missing check. */
export function fixSessionsWithoutPackageInvalid(s: FixSessionsWithoutPackageState): "sessionsNegative" | null {
  if (s.sessions.trim() === "") return null;
  const n = Number(s.sessions);
  return !Number.isFinite(n) || n < 0 ? "sessionsNegative" : null;
}
