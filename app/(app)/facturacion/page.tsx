import { FacturasListView } from "@/components/facturacion/facturas-list-view";

// Facturación GENERAL (productos/servicios). Reusa el componente de lista con contexto=general.
export default function FacturasGeneralListPage() {
  return <FacturasListView contexto="general" />;
}
