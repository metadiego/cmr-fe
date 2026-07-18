"use client";

import { DevolucionesListView } from "@/components/facturacion/devoluciones-list-view";

// Devoluciones de facturación GENERAL. Reusa el componente de lista con contexto=general.
export default function DevolucionesGeneralListPage() {
  return <DevolucionesListView contexto="general" />;
}
