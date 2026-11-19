"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useResource } from "@/hooks/use-resource";
import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { getPendientesEntregaDe, type PendienteEntregaEnCentro } from "@/lib/api/delivery-pending";
import { protocolChangeClinics } from "@/lib/pacientes/protocol-change-clinic";
import { CambioProtocoloForm } from "@/components/clientes/cambio-protocolo-form";

// A protocol change runs in ONE clinic (its packages' clinic, the X-Tenant-ID one). A patient may have
// pending packages in several: one form per such clinic, each under its clinic's name, so nothing is
// hidden behind a picker. `fallback`: the clinic used when there is nothing pending anywhere.
export function CambioProtocoloPorCentro({
  pacienteId,
  fallback,
  onApplied,
}: {
  pacienteId: string;
  fallback: string | null;
  onApplied?: () => void;
}) {
  const t = useTranslations("pacientes.cambioProtocolo");
  const centersRes = useResource<Centro[]>(() => getCentrosDondePuedo("tratamiento.cambio_protocolo"), []);
  const centers = React.useMemo(() => (centersRes.state.kind === "ok" ? centersRes.state.data : []), [centersRes.state]);
  const allowed = React.useMemo(() => centers.map((c) => c.id), [centers]);
  const [version, setVersion] = React.useState(0);
  const pendingRes = useResource<PendienteEntregaEnCentro[]>(
    () => (allowed.length > 1 ? getPendientesEntregaDe(pacienteId, allowed) : Promise.resolve([])),
    [pacienteId, allowed.join(","), version],
  );
  const pending = pendingRes.state.kind === "ok" ? pendingRes.state.data : [];
  const clinics = protocolChangeClinics(
    allowed,
    pending.map((p) => p.clinicId ?? ""),
    fallback ?? allowed[0] ?? null,
  );
  const nameOf = (id: string) => centers.find((c) => c.id === id)?.name ?? "";
  const applied = () => {
    setVersion((v) => v + 1);
    onApplied?.();
  };

  if (centersRes.state.kind === "loading" || pendingRes.state.kind === "loading") {
    return <p className="text-xs text-muted-foreground">{t("cargando")}</p>;
  }
  if (clinics.length === 1 && !(allowed.length > 1)) {
    return <CambioProtocoloForm pacienteId={pacienteId} centro={clinics[0]} onApplied={applied} />;
  }
  return (
    <div className="space-y-6">
      {clinics.map((id) => (
        <div key={id} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("enCentro", { centro: nameOf(id) })}</h3>
          <CambioProtocoloForm key={id} pacienteId={pacienteId} centro={id} onApplied={applied} />
        </div>
      ))}
    </div>
  );
}
