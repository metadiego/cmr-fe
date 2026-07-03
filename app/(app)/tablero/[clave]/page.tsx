import { GenericBoard } from "@/components/tablero/generic-board";

// Generic vertical board. The BE menu points verticals here (path
// /tablero/<clave>); a new vertical = register it + seed its menu item → it
// appears and works with zero FE code.
export default async function TableroPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;
  return <GenericBoard tablero={clave} />;
}
