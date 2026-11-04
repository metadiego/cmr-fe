"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";
import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { protocolChangeClinic } from "@/lib/pacientes/protocol-change-clinic";
import { PacienteSelect } from "@/components/citas/paciente-select";
import type { Paciente } from "@/lib/api/pacientes";
import { CambioProtocoloPorCentro } from "@/components/clientes/cambio-protocolo-por-centro";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Standalone «Cambio de protocolo» route. The owner moved it to a tab of the patient record (1-oct) and the
// BE hid its menu item; this stays as a shortcut with a search box, reusing the SAME form.
// Handoff cambio-de-protocolo-a-la-ficha.
//
// A protocol change works in ONE clinic (its packages' clinic). With several, the page shows one form
// per clinic where the patient has pending packages (CambioProtocoloPorCentro), so there is no picker;
// a ?centro= link (or the top bar) is the clinic used when nothing is pending anywhere.
export default function CambioProtocoloPage() {
  const t = useTranslations("pacientes.cambioProtocolo");
  const tRoot = useTranslations();
  const { can } = useCan();
  const puede = can("tratamiento.cambio_protocolo");
  const urlCenter = useSearchParams().get("centro");
  const me = useMe();
  const sessionCenter = me.kind === "ok" ? (me.me.activeClinicId ?? null) : null;

  const centersRes = useResource<Centro[]>(() => getCentrosDondePuedo("tratamiento.cambio_protocolo"), []);
  const centers = centersRes.state.kind === "ok" ? centersRes.state.data : [];
  const centro = protocolChangeClinic(
    centers.map((c) => c.id),
    null,
    urlCenter,
    getActiveCentro() ?? sessionCenter,
  );

  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const pacienteId = paciente ? String((paciente as { id?: string }).id ?? "") : "";

  if (!puede) {
    return <PageContainer><p className="text-sm text-muted-foreground">{tRoot("common.forbidden")}</p></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {/* Toolbar: the patient search, and the clinic the change is made in when there is more than one. */}
      <div role="search" aria-label={t("paciente")} className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:max-w-sm">
          <PacienteSelect value={paciente} onChange={setPaciente} />
        </div>
      </div>
      {pacienteId && <CambioProtocoloPorCentro key={pacienteId} pacienteId={pacienteId} fallback={centro} />}
    </PageContainer>
  );
}
