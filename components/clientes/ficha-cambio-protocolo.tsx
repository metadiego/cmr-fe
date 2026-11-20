"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getCambiosProtocolo, type CambioProtocoloHistorial } from "@/lib/api/protocol-change";
import { listMedicos, type MedicoOpcion } from "@/lib/api/facturacion-config";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { CambioProtocoloPorCentro } from "@/components/clientes/cambio-protocolo-por-centro";
import { EmptyState, Panel } from "@/components/kit/panel";

// «Cambio de protocolo» tab of the patient record: the action (replace pending therapies) and, beside
// it, the history (newest first), both for the patient already known. Handoff
// cambio-de-protocolo-a-la-ficha. The record gates the permission (tratamiento.cambio_protocolo).
export function FichaCambioProtocolo({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("pacientes.cambioProtocolo");
  const format = useFormatter();

  const histRes = useResource<CambioProtocoloHistorial[]>(
    () => getCambiosProtocolo(pacienteId, centro),
    [pacienteId, centro],
  );
  const historial = histRes.state.kind === "ok" ? histRes.state.data : [];

  // Doctor name (the history carries the doctor id; it may be null → shown as «—»).
  const medRes = useResource<MedicoOpcion[]>(() => listMedicos(centro ?? undefined), [centro]);
  const medById = React.useMemo(() => {
    const m = new Map<string, string>();
    if (medRes.state.kind === "ok") for (const d of medRes.state.data) m.set(d.id, d.name);
    return m;
  }, [medRes.state]);

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* The action first and wider: it is what this tab is opened for; the history sits beside it. */}
      <Panel title={t("nuevoTitulo")} className="xl:col-span-3">
        <div className="px-5 py-4">
          <CambioProtocoloPorCentro pacienteId={pacienteId} fallback={centro ?? null} onApplied={() => histRes.reload()} />
        </div>
      </Panel>

      <Panel title={t("historialTitulo")} className="self-start xl:col-span-2">
        {histRes.state.kind === "loading" ? (
          <EmptyState>{t("cargando")}</EmptyState>
        ) : historial.length === 0 ? (
          <EmptyState>{t("sinHistorial")}</EmptyState>
        ) : (
          <ol className="divide-y">
            {historial.map((c) => (
              <li key={c.changeId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{format.dateTime(parseDayUTC(c.date.slice(0, 10)) ?? new Date(c.date), "dayLong")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("cambioResumen", { cerrados: c.closedPackages.length, creados: c.createdPackages.length })}
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">{t("motivo")}</dt>
                  <dd>{c.reason || "—"}</dd>
                  <dt className="text-muted-foreground">{t("medico")}</dt>
                  <dd>{c.doctorId ? (medById.get(c.doctorId) ?? "—") : "—"}</dd>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
