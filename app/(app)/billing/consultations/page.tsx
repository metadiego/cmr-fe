import { FacturacionConTabs } from "@/components/facturacion/facturacion-con-tabs";

// Facturación de CONSULTAS: Facturas / Devoluciones / Cuadre de caja, como pestañas de la misma
// división (ver facturacion-con-tabs.tsx). Las facturas de consulta se crean desde el AP-board, no
// "Nueva venta" — eso ya lo decide FacturasListView por su `contexto`.
export default function FacturasConsultaListPage() {
  return <FacturacionConTabs contexto="consulta" />;
}
