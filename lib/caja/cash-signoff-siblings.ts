import { getCashSignatures } from "@/lib/api/caja";
import {
  cashierSiblingsFromReport,
  hasRealCashCount,
  type CashSignature,
  type CuadreSheetInfo,
  type PorCajeroEntry,
  type SiblingSheet,
} from "./sign-off";

// Resolves the consolidated/day-total sign-off siblings end to end (BE #605, handoff
// firmas-consolidado-desde-ventas): rules 1-3 via the pure `cashierSiblingsFromReport`, then rule
// 4 — a sheet owner who did NOT collect keeps her block only if she already has a live cashier
// signature (needs a fetch) or a real count. Shared by cuadre-caja.tsx and cuadre-total.tsx so
// neither inlines the same async loop.
export async function resolveCashierSiblings(args: {
  porCajero: PorCajeroEntry[];
  cuadres: CuadreSheetInfo[];
  division?: string | null;
  nameFor?: (userId: string) => string | null;
  centerId?: string | null;
}): Promise<SiblingSheet[]> {
  const { siblings, leftoverSheets } = cashierSiblingsFromReport(args);
  const extra = await Promise.all(
    leftoverSheets.map(async (c) => {
      if (hasRealCashCount(c)) return c;
      const firmas = await getCashSignatures(c.id, args.centerId).catch(() => [] as CashSignature[]);
      return firmas.some((f) => f.role === "cashier" && !f.voidedAt) ? c : null;
    }),
  );
  const extraSiblings = extra
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => ({ id: c.id, userId: c.userId!, division: c.division ?? args.division, name: args.nameFor?.(c.userId!) ?? null }));
  return [...siblings, ...extraSiblings];
}
