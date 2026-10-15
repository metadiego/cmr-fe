// Evidence of a sales package on an invoice line: the BE freezes it in `meta.salesPackage` when the
// package is sold (so old invoices keep it even if the package changes). Pure, so it is tested; used
// by the invoice view, the print/PDF and the thermal receipt. Handoff paquetes-de-venta-handoff-fe.md.

export interface SalesPackageEvidence {
  id: string
  name: string
  sessions: number
  regularUnitPrice: number
  regularPrice: number
  packagePrice: number
  savings: number
}

interface LineLike {
  salesPackageId?: string | null
  meta?: unknown
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v))

export function packageEvidence(item: LineLike): SalesPackageEvidence | null {
  const sp = (item.meta as { salesPackage?: Record<string, unknown> } | null | undefined)?.salesPackage
  if (!sp || typeof sp !== "object") return null
  const e = {
    id: String(sp.id ?? ""),
    name: String(sp.name ?? ""),
    sessions: num(sp.sessions),
    regularUnitPrice: num(sp.regularUnitPrice),
    regularPrice: num(sp.regularPrice),
    packagePrice: num(sp.packagePrice),
    savings: num(sp.savings),
  }
  return Number.isFinite(e.regularPrice) && Number.isFinite(e.savings) ? e : null
}

// A package line cannot change quantity, price or discount (the BE answers 409
// SALES_PACKAGE_LINE_LOCKED); it can be removed, and its description edited.
export function isPackageLine(item: LineLike): boolean {
  return !!item.salesPackageId
}

// Savings as a whole percentage of the regular price, for display only (from the BE's own numbers).
export function savingsPct(e: SalesPackageEvidence): number {
  return e.regularPrice > 0 ? Math.round((e.savings / e.regularPrice) * 100) : 0
}

// «Usted ahorró»: the sum of the savings of the invoice's package lines; 0 when it has none.
export function invoiceSavings(items: LineLike[]): number {
  const cents = items.reduce((acc, it) => acc + Math.round((packageEvidence(it)?.savings ?? 0) * 100), 0)
  return cents / 100
}
