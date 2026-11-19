// A legacy invoice was rounded by the legacy: its stored total can be a cent or two below the sum of its
// lines (S040286: lines 1616.80, total 1616.79). Mirrors the BE rule (cmr-be #643,
// docs/specs/devolucion-de-facturas-del-legado-handoff.md): for a MIGRATED invoice, when every line states
// its amount and none carries kit components, an overshoot within the tolerance does not block — the BE
// takes it off the largest line and answers `roundingAdjustment`. Anything beyond it is not rounding.

/** BE default while the policy does not say (`config.legacyRoundingTolerance`). */
export const LEGACY_ROUNDING_TOLERANCE = 0.05;

const cents = (n: number) => Math.round(n * 100);

/** The tolerance from the refund policy's config: a number in [0, 1], else the default. */
export function toleranceFrom(config: Record<string, unknown> | null | undefined): number {
  const v = Number(config?.legacyRoundingTolerance);
  return config?.legacyRoundingTolerance != null && Number.isFinite(v) && v >= 0 && v <= 1 ? v : LEGACY_ROUNDING_TOLERANCE;
}

export type RefundCheck = {
  /** The net over the cap that is NOT rounding: blocks as before. */
  exceeds: boolean;
  /** What the BE will take off (0 = nothing), e.g. 0.01. */
  adjustment: number;
  /** The net to show: the cap when adjusted, else the typed net. */
  net: number;
};

export function legacyRefundCheck(p: {
  net: number;
  cap: number;
  legacy: boolean;
  /** Every selected line sends its own amount and none has components (what the BE needs to trim). */
  everyLineHasAmount: boolean;
  /** The largest line's amount: the BE never trims below zero. */
  largestLine: number;
  tolerance: number;
}): RefundCheck {
  const excess = cents(p.net) - cents(p.cap);
  if (excess <= 0) return { exceeds: false, adjustment: 0, net: p.net };
  const trimmable = p.legacy && p.everyLineHasAmount && excess <= cents(p.tolerance) && cents(p.largestLine) >= excess;
  return trimmable ? { exceeds: false, adjustment: excess / 100, net: p.cap } : { exceeds: true, adjustment: 0, net: p.net };
}
