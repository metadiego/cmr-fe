import { notFound } from "next/navigation";

import { CuadreCaja } from "@/components/caja/cuadre-caja";
import type { CajaDivision } from "@/lib/api/caja";

// Cuadre de Caja por DIVISIÓN (destinos separados: /billing/cash/consultation y
// /billing/cash/general). El usuario exige no mezclar: cada destino fija su división
// (nada de un solo "Caja" con toggle). La RUTA es inglesa (route-reorg); el valor de
// división del BE sigue siendo consulta/general (lib/api/caja, intocable), así que
// aquí se mapea el segmento de URL → división del BE.
// See docs/specs/2026-07-20-cuadre-caja-design.md.
const ROUTE_TO_DIVISION: Record<string, CajaDivision> = {
  consultation: "consulta",
  general: "general",
};

export default async function CajaDivisionPage({
  params,
}: {
  params: Promise<{ division: string }>;
}) {
  const { division } = await params;
  const beDivision = ROUTE_TO_DIVISION[division];
  if (!beDivision) notFound();
  return <CuadreCaja division={beDivision} />;
}
