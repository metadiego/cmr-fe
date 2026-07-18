"use client";

import { DevolucionesListView } from "@/components/facturacion/devoluciones-list-view";

// Devoluciones de facturación de CONSULTAS. Mismo componente que General, con contexto=consulta.
export default function DevolucionesConsultaListPage() {
  return <DevolucionesListView contexto="consulta" />;
}
