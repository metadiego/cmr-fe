import type { components } from "./schema";
import { apiFetch } from "./client";
import type { FacturaItem } from "./facturas";

// Sales packages per center (e.g. «Láser IV · 12 terapias»: 12 sessions for $1,440). The BE computes
// the regular price from the catalog and the savings — the FE never recalculates them. Handoff
// docs/specs/paquetes-de-venta-handoff-fe.md.
export type SalesPackage = components["schemas"]["SalesPackageResponseDto"];
export type CreateSalesPackagePayload = components["schemas"]["CreateSalesPackageDto"];
export type UpdateSalesPackagePayload = components["schemas"]["UpdateSalesPackageDto"];

// `centroId` resolves the permission in that center (X-Tenant-ID) and also goes as `centerIds`.
export function listSalesPackages(
  opts: { centroId?: string; includeInactive?: boolean } = {},
): Promise<SalesPackage[]> {
  const sp = new URLSearchParams();
  if (opts.centroId) sp.set("centerIds", opts.centroId);
  if (opts.includeInactive) sp.set("includeInactive", "true");
  const q = sp.toString();
  return apiFetch<SalesPackage[]>(`/billing/sales-packages${q ? `?${q}` : ""}`, {}, opts.centroId);
}

export function createSalesPackage(payload: CreateSalesPackagePayload, centroId?: string): Promise<SalesPackage> {
  return apiFetch<SalesPackage>(`/billing/sales-packages`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Partial; the center does not change. `{ active: true }` reactivates a retired package.
export function updateSalesPackage(id: string, payload: UpdateSalesPackagePayload, centroId?: string): Promise<SalesPackage> {
  return apiFetch<SalesPackage>(`/billing/sales-packages/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Retires it (active=false) — never deleted, invoices name it.
export function retireSalesPackage(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/billing/sales-packages/${id}`, { method: "DELETE" }, centroId);
}

// Sells a package on a draft invoice: a line at the REGULAR price with the package's discount, marked
// with salesPackageId and frozen in meta.salesPackage. Returns the created line.
export function sellSalesPackage(invoiceId: string, packageId: string, centroId?: string): Promise<FacturaItem> {
  return apiFetch<FacturaItem>(
    `/invoices/${invoiceId}/sales-packages`,
    { method: "POST", body: JSON.stringify({ packageId }) },
    centroId,
  );
}
