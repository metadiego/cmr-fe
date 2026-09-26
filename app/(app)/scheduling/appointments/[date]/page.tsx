"use client";

import { useParams, useSearchParams } from "next/navigation";

import { DiaView } from "@/components/agenda/dia-view";
import { ServiceDayView } from "@/components/agenda/service-day-view";

// Day view reached by clicking a day in a calendar. `?tab=servicios` → the service-therapies day view
// (panorama + hour occupancy + plan); otherwise the medical call-center day sheet (DiaView).
export default function AgendaDiaPage() {
  // El segmento de la ruta se llama `date` (carpeta `[date]`), no `fecha`: leerlo con el nombre
  // equivocado mandaba `date=undefined` al BE y la vista-día no cargaba nunca.
  const params = useParams<{ date: string }>();
  const tab = useSearchParams().get("tab");
  if (tab === "servicios") return <ServiceDayView fecha={params.date} />;
  return <DiaView fecha={params.date} />;
}
