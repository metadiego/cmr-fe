import { notFound } from "next/navigation";

import { CuadreCaja } from "@/components/caja/cuadre-caja";
import type { CajaDivision } from "@/lib/api/caja";

// Cuadre de Caja por DIVISIÓN (destinos separados: /caja/consulta y /caja/general). El usuario
// exige no mezclar: cada destino fija su división (nada de un solo "Caja" con toggle). Server
// component que valida la división y monta el cliente. See docs/specs/2026-07-20-cuadre-caja-design.md.
const DIVISIONES: CajaDivision[] = ["consulta", "general"];

export default async function CajaDivisionPage({
  params,
}: {
  params: Promise<{ division: string }>;
}) {
  const { division } = await params;
  if (!DIVISIONES.includes(division as CajaDivision)) notFound();
  return <CuadreCaja division={division as CajaDivision} />;
}
