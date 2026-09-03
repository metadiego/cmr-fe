"use client";

import { useParams } from "next/navigation";

import { DiaView } from "@/components/agenda/dia-view";

// Day-view (call-center sheet): franjas × tipo with cupo/vacios, dynamic columns,
// multi-center. Reached by clicking a day in the medical calendar.
export default function AgendaDiaPage() {
  const params = useParams<{ fecha: string }>();
  return <DiaView fecha={params.fecha} />;
}
