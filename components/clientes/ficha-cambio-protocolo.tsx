"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getCambiosProtocolo, type CambioProtocoloHistorial } from "@/lib/api/frontdesk";
import { listMedicos, type MedicoOpcion } from "@/lib/api/facturacion-config";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { CambioProtocoloForm } from "@/components/clientes/cambio-protocolo-form";

// Pestaña «Cambio de protocolo» de la ficha del paciente: ARRIBA el historial (lo que ya tuvo, del más
// reciente al más viejo) y ABAJO la acción (reemplazar terapias pendientes), ambas para el paciente ya
// conocido. Handoff cambio-de-protocolo-a-la-ficha. El permiso lo gatea la ficha (tratamiento.cambio_protocolo).
export function FichaCambioProtocolo({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("pacientes.cambioProtocolo");
  const format = useFormatter();

  const histRes = useResource<CambioProtocoloHistorial[]>(
    () => getCambiosProtocolo(pacienteId, centro),
    [pacienteId, centro],
  );
  const historial = histRes.state.kind === "ok" ? histRes.state.data : [];

  // Nombre del médico (el historial trae medicoId; puede ser null → se muestra «—»).
  const medRes = useResource<MedicoOpcion[]>(() => listMedicos(centro ?? undefined), [centro]);
  const medById = React.useMemo(() => {
    const m = new Map<string, string>();
    if (medRes.state.kind === "ok") for (const d of medRes.state.data) m.set(d.id, d.name);
    return m;
  }, [medRes.state]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("historialTitulo")}</h2>
        {histRes.state.kind === "loading" ? (
          <p className="text-xs text-muted-foreground">{t("cargando")}</p>
        ) : historial.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{t("sinHistorial")}</p>
        ) : (
          <ul className="space-y-2">
            {historial.map((c) => (
              <li key={c.cambioId} className="rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{format.dateTime(parseDayUTC(c.fecha.slice(0, 10)) ?? new Date(c.fecha), "dayLong")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("cambioResumen", { cerrados: c.paquetesCerrados.length, creados: c.paquetesCreados.length })}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>{t("motivo")}: {c.motivo || "—"}</span>
                  <span>{t("medico")}: {c.medicoId ? (medById.get(c.medicoId) ?? "—") : "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("nuevoTitulo")}</h2>
        <CambioProtocoloForm pacienteId={pacienteId} centro={centro} onApplied={() => histRes.reload()} />
      </section>
    </div>
  );
}
