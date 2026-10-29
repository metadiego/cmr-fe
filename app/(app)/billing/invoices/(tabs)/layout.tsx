import { FacturacionConTabs } from "@/components/facturacion/facturacion-con-tabs";

// General billing (products/services): Invoices / Returns / Cash count / Stats, as tabs of the same
// division (see facturacion-con-tabs.tsx). Each tab is its own path (/billing/invoices/returns, …);
// the route group keeps this layout off the invoice pages below (/billing/invoices/new, /[id]).
export default function GeneralBillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FacturacionConTabs contexto="general" />
      {children}
    </>
  );
}
