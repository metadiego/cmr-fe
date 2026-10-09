import { FacturacionConTabs } from "@/components/facturacion/facturacion-con-tabs";

// Facturación GENERAL (productos/servicios): Facturas / Devoluciones / Cuadre de caja, como pestañas
// de la misma división (ver facturacion-con-tabs.tsx).
export default function FacturasGeneralListPage() {
  return <FacturacionConTabs contexto="general" />;
}
