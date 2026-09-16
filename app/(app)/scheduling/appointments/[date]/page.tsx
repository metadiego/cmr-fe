"use client";

import { useParams } from "next/navigation";

import { DiaView } from "@/components/agenda/dia-view";

// Day-view (call-center sheet): franjas × tipo with cupo/vacios, dynamic columns,
// multi-center. Reached by clicking a day in the medical calendar.
export default function AgendaDiaPage() {
  // El segmento de la ruta se llama `date` (carpeta `[date]`), no `fecha`: leerlo con el nombre
  // equivocado mandaba `date=undefined` al BE y la vista-día no cargaba nunca.
  const params = useParams<{ date: string }>();
  return <DiaView fecha={params.date} />;
}
