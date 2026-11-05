import { apiFetch } from "@/lib/api/client";
import type { ProductSalesInvoice, TaxBreakdown } from "@/lib/caja/product-sales";

// Month-end report of product invoices that should have carried IVU but were exonerated (legacy CMA
// repventasnoivu.php). BE PR #470, handoff docs/specs/cash-product-sales-ivu-handoff.md §3. Shape
// copied from the REAL v2 response (Bayamón, Oct-2026). Per center like all money: X-Tenant-ID.
export type ExoneratedProductsReport = {
  from: string;
  to: string;
  invoices: ProductSalesInvoice[];
  totals: {
    invoices: number;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    exoneratedBase: number;
    refunded?: number;
    taxWouldBe: TaxBreakdown;
  };
};

export function getExoneratedProducts(from: string, to: string, centerId?: string): Promise<ExoneratedProductsReport> {
  const sp = new URLSearchParams({ from, to });
  return apiFetch<ExoneratedProductsReport>(`/billing/reports/exonerated-products?${sp.toString()}`, {}, centerId);
}
