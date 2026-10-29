import { FacturacionConTabs } from "@/components/facturacion/facturacion-con-tabs";

// Consultation billing: Invoices / Returns / Cash count, as tabs of the same division (see
// facturacion-con-tabs.tsx), each on its own path (/billing/consultations/returns, …). Consultation
// invoices are created from the AP board, not "New sale" — FacturasListView decides that by `contexto`.
export default function ConsultationBillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FacturacionConTabs contexto="consulta" />
      {children}
    </>
  );
}
