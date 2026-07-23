import { redirect } from "next/navigation";

import { GenericBoard } from "@/components/tablero/generic-board";
import { FrontdeskBoard } from "@/components/frontdesk/frontdesk-board";

// Ruta ÚNICA de tableros: /tablero/<clave>. El patrón de URL es innegociable; el CONTENIDO se
// resuelve por dato (la `clave`): 'frontdesk' monta el board bespoke del frontdesk (tabs por
// servicio, doble fecha, Citar); el resto usa el builder genérico. Prohibido crear rutas bespoke
// nuevas. See docs/specs/fe-frontdesk-ruta-tablero-handoff.md.
export default async function TableroPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;
  // 'servicios' era el alias legacy del frontdesk → consolidar en la clave canónica.
  if (clave === "servicios") redirect("/tablero/frontdesk");
  if (clave === "frontdesk") return <FrontdeskBoard />;
  return <GenericBoard tablero={clave} />;
}
