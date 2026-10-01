"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useCentroGate } from "@/hooks/use-centro-gate";
import { useCan } from "@/hooks/use-can";
import { PacienteSelect } from "@/components/citas/paciente-select";
import type { Paciente } from "@/lib/api/pacientes";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { CambioProtocoloForm } from "@/components/clientes/cambio-protocolo-form";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Ruta suelta de «Cambio de protocolo». El dueño la movió a una pestaña de la ficha del paciente (1-oct) y
// el BE ya ocultó su ítem de menú; esta queda como acceso directo con buscador, reusando el MISMO formulario.
// Handoff cambio-de-protocolo-a-la-ficha.
export default function CambioProtocoloPage() {
  const t = useTranslations("pacientes.cambioProtocolo");
  const tRoot = useTranslations();
  const gate = useCentroGate();
  const { can } = useCan();
  const puede = can("tratamiento.cambio_protocolo");
  const centro = useSearchParams().get("centro") ?? gate.centro;

  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const pacienteId = paciente ? String((paciente as { id?: string }).id ?? "") : "";

  if (!puede) {
    return <PageContainer><p className="text-sm text-muted-foreground">{tRoot("common.forbidden")}</p></PageContainer>;
  }
  if (gate.necesitaPicker) {
    return <PageContainer><CentroPicker centros={gate.centros} onPick={gate.pick} /></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      <div className="max-w-md">
        <Label>{t("paciente")}</Label>
        <PacienteSelect value={paciente} onChange={setPaciente} />
      </div>
      {pacienteId && <div className="mt-6"><CambioProtocoloForm pacienteId={pacienteId} centro={centro ?? undefined} /></div>}
    </PageContainer>
  );
}
