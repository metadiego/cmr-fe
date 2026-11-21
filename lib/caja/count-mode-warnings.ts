import type { CashCountModeWarning } from "../api/caja.ts";
import { money } from "./totales.ts";

// countMode.warnings of the cash total (BE #566 and the consolidated-override warning, handoff
// docs/specs/cuadre-aviso-conteo-consolidado.md). They never block the close, they inform. Severity lives
// HERE, by code: a code that needs to read as red goes in this map; anything else stays amber.

export type WarningSeverity = "destructive" | "warning";

const SEVERITY: Record<string, WarningSeverity> = {
  // A consolidated count replaced the cashiers' counts: the sheet may show a shortage that is not real.
  CONSOLIDATED_COUNT_OVERRIDES_CASHIERS: "destructive",
};

export function warningSeverity(code: string): WarningSeverity {
  return SEVERITY[code] ?? "warning";
}

/** Red first, then amber; the BE order is kept within each. */
export function sortWarnings<T extends { code: string }>(warnings: readonly T[]): T[] {
  return warnings
    .map((w, i) => ({ w, i, red: warningSeverity(w.code) === "destructive" ? 0 : 1 }))
    .sort((a, b) => a.red - b.red || a.i - b.i)
    .map((x) => x.w);
}

/**
 * Translation values of a warning: the division's label plus every `params` amount as money. Generic on
 * purpose: a future warning with amounts works without touching the screen. Missing params → nothing added.
 */
export function warningValues(w: CashCountModeWarning, divisionLabel?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (divisionLabel) out.division = divisionLabel;
  for (const [k, v] of Object.entries(w.params ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = money(v);
    else if (v != null) out[k] = String(v);
  }
  return out;
}
