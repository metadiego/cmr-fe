// Checks for the "Fix availability" dialog (components/frontdesk/corregir-disponibilidad-dialog.tsx).
// Empty → missing; filled but not acceptable → `fixAvailabilityInvalid` (it keeps the button disabled, as today).

export type FixAvailabilityState = {
  /** Package breakdown being edited (e.g. { dias: "12", areas: "1" }); null when the package has none. */
  multipliers: Record<string, string> | null;
  /** Total sessions typed, used only when there is no breakdown. */
  total: string;
  /** Sessions already delivered: the total cannot go below this. */
  delivered: number;
};

/** "totalSessions", or `mult.<key>` for a breakdown value (the i18n key of its label). */
export type FixAvailabilityField = "totalSessions" | `mult.${string}`;

export type FixAvailabilityProblem = "belowDelivered" | "multiplierNotPositive";

const hasMultipliers = (s: FixAvailabilityState): s is FixAvailabilityState & { multipliers: Record<string, string> } =>
  !!s.multipliers && Object.keys(s.multipliers).length > 0;

/** Empty required fields, in on-screen order. */
export function fixAvailabilityMissing(s: FixAvailabilityState): FixAvailabilityField[] {
  if (hasMultipliers(s)) {
    return Object.entries(s.multipliers)
      .filter(([, v]) => v.trim() === "")
      .map(([k]) => `mult.${k}` as const);
  }
  return s.total.trim() === "" ? ["totalSessions"] : [];
}

/** Why the filled values cannot be saved, or null. Empty values are left to `fixAvailabilityMissing`. */
export function fixAvailabilityInvalid(s: FixAvailabilityState): FixAvailabilityProblem | null {
  if (hasMultipliers(s)) {
    const bad = Object.values(s.multipliers).some((v) => {
      if (v.trim() === "") return false;
      const n = Number(v);
      return !Number.isFinite(n) || n <= 0;
    });
    return bad ? "multiplierNotPositive" : null;
  }
  if (s.total.trim() === "") return null;
  const n = Number(s.total);
  return !Number.isFinite(n) || n < s.delivered ? "belowDelivered" : null;
}
