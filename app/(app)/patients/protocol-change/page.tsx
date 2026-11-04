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
import { CambioProtocoloForm } from "@/components/clientes/cambio-protocolo-form";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Standalone «Cambio de protocolo» route. The owner moved it to a tab of the patient record (1-oct) and the
// BE hid its menu item; this stays as a shortcut with a search box, reusing the SAME form.
// Handoff cambio-de-protocolo-a-la-ficha.
//
// A protocol change works in ONE clinic: the BE reads the pending packages and writes the change in the
// X-Tenant-ID clinic (cmr-be `pendientesEntrega`, `CambioProtocoloService.aplicar`). So instead of a
// blocking picker, the toolbar names the clinic (any where the person holds tratamiento.cambio_protocolo)
// and lets them switch it in place; a ?centro= link preselects it.
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
  const [picked, setPicked] = React.useState<string | null>(null);
  const centro = protocolChangeClinic(
    centers.map((c) => c.id),
    picked,
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
        {centers.length > 1 && centro && (
          <Select value={centro} onValueChange={setPicked}>
            <SelectTrigger className="w-48" aria-label={tRoot("centroSel.label")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {centers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      {pacienteId && centro && <CambioProtocoloForm key={centro} pacienteId={pacienteId} centro={centro} />}
    </PageContainer>
  );
}
