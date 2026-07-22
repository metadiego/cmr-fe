import { redirect } from "next/navigation";

import { GenericBoard } from "@/components/tablero/generic-board";

// Generic vertical board. The BE menu points verticals here (path
// /tablero/<clave>); a new vertical = register it + seed its menu item → it
// appears and works with zero FE code.
// `servicios` tiene vista PROPIA (Frontdesk del día, F4) → un solo lugar, sin
// duplicar la misma pantalla en dos rutas. El resto de verticales usa el genérico.
export default async function TableroPage({
  params,
}: {
  params: Promise<{ clave: string }>;
}) {
  const { clave } = await params;
  if (clave === "servicios") redirect("/frontdesk");
  return <GenericBoard tablero={clave} />;
}
