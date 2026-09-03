import { FacturasListView } from "@/components/facturacion/facturas-list-view";

// Facturación de CONSULTAS. Mismo componente/lista que General, con contexto=consulta (las de consulta
// se crean desde el AP-board, no "Nueva venta"). Reuso — sin lógica nueva.
export default function FacturasConsultaListPage() {
  return <FacturasListView contexto="consulta" />;
}
