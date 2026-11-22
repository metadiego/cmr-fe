// Per-cashier counts and the consolidated override inside `divisionCounts.<d>` of GET
// /cash/total-reconciliation (handoff docs/specs/cuadre-aviso-conteo-consolidado.md, second part).
// Its own file because lib/api/caja.ts sits at the 600-line ceiling.

export interface DivisionCashierCount {
  /** null for a cashier who charged cash but has no sheet of their own. */
  reconciliationId: string | null;
  userId: string | null;
  name: string | null;
  counted: number;
  fund: number;
  /** Cash this cashier billed in the division. */
  expected: number;
  /** counted − fund − expected. */
  difference: number;
  balanced: boolean;
}
export interface DivisionCountOverride {
  counted: number;
  cashiersCounted: number;
  difference: number;
  countedBy: { staffId: string; name: string | null } | null;
}
