import { multipliersText, quantityBreakdownText, type QuantityBreakdown } from "../factura/receipt-format.ts";

type LineLike = {
  meta?: unknown;
  quantity?: number | null;
  quantityBreakdown?: QuantityBreakdown | null;
};

// Multiplicadores (láser: áreas×días), leídos de meta.multiplicadores — data-driven, sin asumir
// cuáles ni cuántos. null = la línea no tiene.
export function lineMultipliers(it: LineLike): Record<string, number> | null {
  const m = (it.meta as { multiplicadores?: Record<string, number> } | null | undefined)?.multiplicadores;
  return m && Object.keys(m).length ? m : null;
}

// cmr-be #619: aún no está en Swagger (mismo drift que meta.multiplicadores) — passthrough tal cual
// lo manda el BE, verificado en vivo (S040541, Caguas).
export function lineQuantityBreakdown(it: LineLike): QuantityBreakdown | null {
  return it.quantityBreakdown ?? null;
}

// Cantidad EFECTIVA = base × Π(multiplicadores).
export function effectiveQuantity(it: LineLike): number {
  const m = lineMultipliers(it);
  const base = Number(it.quantity ?? 0) || 1;
  return m ? Object.values(m).reduce((p, v) => p * (Number(v) || 1), base) : base;
}

// Leyenda de una línea: quantityBreakdown (grupo en modo "breakdown") sustituye a multiplicadores,
// nunca las dos juntas. `label` resuelve una clave i18n COMPLETA (fac.col.<k> o la labelKey del BE).
export function lineLegend(it: LineLike, label: (key: string) => string): string | null {
  const qb = lineQuantityBreakdown(it);
  if (qb) return quantityBreakdownText(qb, label);
  const m = lineMultipliers(it);
  return m ? multipliersText(m, (k) => label(`fac.col.${k}`)) : null;
}
