"use client";

import { useParams } from "next/navigation";
import { TransferenciaRecibir } from "@/components/inventario/transferencias/transferencia-recibir";

export default function TransferenciaDetallePage() {
  const params = useParams();
  const id = String(params.id);
  return <TransferenciaRecibir id={id} />;
}
