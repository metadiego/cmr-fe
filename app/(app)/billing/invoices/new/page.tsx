import { redirect } from "next/navigation";
import { VentaGeneral } from "@/components/facturacion/venta-general";

// "Facturación general" (menú) NO abre la creación directa. Sin ?nuevo=1 → va a la LISTA
// (/facturacion, con picker de centro para admins). Crear solo con "Nueva venta" (llega con ?nuevo=1).
// Redirect en SERVIDOR (no en un effect de cliente → evita "Router action dispatched before init").
export default async function FacturacionGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string; centro?: string }>;
}) {
  const sp = await searchParams;
  if (sp?.nuevo !== "1") {
    redirect(`/billing/invoices${sp?.centro ? `?centro=${sp.centro}` : ""}`);
  }
  return <VentaGeneral />;
}
