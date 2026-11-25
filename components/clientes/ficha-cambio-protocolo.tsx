"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import {
  getCambiosProtocolo,
  type CambioProtocoloHistorial,
} from "@/lib/api/protocol-change"
import { listMedicos, type MedicoOpcion } from "@/lib/api/facturacion-config"
import { parseDayUTC } from "@/lib/format/fecha"
import { money } from "@/lib/caja/totales"
import { signedMoney } from "@/lib/pacientes/protocol-change-simulation"
import { useResource } from "@/hooks/use-resource"
import { HugeiconsIcon } from "@hugeicons/react"
import { WorkHistoryIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { CambioProtocoloPorCentro } from "@/components/clientes/cambio-protocolo-por-centro"
import { EmptyState, Panel } from "@/components/kit/panel"

// «Cambio de protocolo» tab of the patient record: the action (replace pending therapies) and, on
// demand, the history (newest first) beside it. The history starts closed so the action gets the whole
// width (owner, 24-nov-2026); one click opens it and it stays open for comparing while on the page. Handoff
// cambio-de-protocolo-a-la-ficha. The record gates the permission (tratamiento.cambio_protocolo).
export function FichaCambioProtocolo({
  pacienteId,
  centro,
}: {
  pacienteId: string
  centro?: string
}) {
  const t = useTranslations("pacientes.cambioProtocolo")
  const format = useFormatter()

  const histRes = useResource<CambioProtocoloHistorial[]>(
    () => getCambiosProtocolo(pacienteId, centro),
    [pacienteId, centro]
  )
  const historial = histRes.state.kind === "ok" ? histRes.state.data : []

  // Doctor name (the history carries the doctor id; it may be null → shown as «—»).
  const medRes = useResource<MedicoOpcion[]>(
    () => listMedicos(centro ?? undefined),
    [centro]
  )
  const medById = React.useMemo(() => {
    const m = new Map<string, string>()
    if (medRes.state.kind === "ok")
      for (const d of medRes.state.data) m.set(d.id, d.name)
    return m
  }, [medRes.state])

  const [showHistory, setShowHistory] = React.useState(false)
  const count = histRes.state.kind === "ok" ? historial.length : null

  return (
    <div className={showHistory ? "grid gap-6 xl:grid-cols-5" : "grid gap-6"}>
      {/* The action first and wider: it is what this tab is opened for; the history opens beside it. */}
      <Panel
        title={t("nuevoTitulo")}
        className={showHistory ? "xl:col-span-3" : undefined}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showHistory}
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            <HugeiconsIcon icon={WorkHistoryIcon} className="size-4" />
            {showHistory
              ? t("historialOcultar")
              : t("historialVer", { n: count ?? "…" })}
          </Button>
        }
      >
        <div className="px-5 py-4">
          <CambioProtocoloPorCentro
            pacienteId={pacienteId}
            fallback={centro ?? null}
            onApplied={() => histRes.reload()}
          />
        </div>
      </Panel>

      {showHistory && (
        <Panel
          title={t("historialTitulo")}
          className="self-start xl:col-span-2"
        >
          {histRes.state.kind === "loading" ? (
            <EmptyState>{t("cargando")}</EmptyState>
          ) : historial.length === 0 ? (
            <EmptyState>{t("sinHistorial")}</EmptyState>
          ) : (
            <ol className="divide-y">
              {historial.map((c) => (
                <li key={c.changeId} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {format.dateTime(
                        parseDayUTC(c.date.slice(0, 10)) ?? new Date(c.date),
                        "dayLong"
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("cambioResumen", {
                        cerrados: c.closedPackages.length,
                        creados: c.createdPackages.length,
                      })}
                    </span>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">{t("motivo")}</dt>
                    <dd>{c.reason || "—"}</dd>
                    <dt className="text-muted-foreground">{t("medico")}</dt>
                    <dd>
                      {c.doctorId ? (medById.get(c.doctorId) ?? "—") : "—"}
                    </dd>
                  </dl>
                  {/* What was agreed (cmr-be #691); changes before 24-nov-2026 have none and show nothing. */}
                  {c.valuation && (
                    <div className="mt-2 space-y-1 text-xs">
                      <p className="font-medium tabular-nums">
                        {t("valuation", {
                          closed: money(c.valuation.totals.closedValue),
                          created: money(c.valuation.totals.createdValue),
                          difference: signedMoney(
                            c.valuation.totals.difference,
                            money
                          ),
                        })}
                      </p>
                      <ul className="text-muted-foreground tabular-nums">
                        {[
                          ...c.valuation.closes.map((x) => ({
                            k: `c-${x.packageId}`,
                            sign: "−",
                            ...x,
                          })),
                          ...c.valuation.creates.map((x, i) => ({
                            k: `n-${x.productId}-${i}`,
                            sign: "+",
                            ...x,
                          })),
                        ].map((x) => (
                          <li key={x.k}>
                            {x.sign} {x.name ?? "—"} · {x.units} ×{" "}
                            {x.unitPrice != null ? money(x.unitPrice) : "—"} ={" "}
                            {x.value != null ? money(x.value) : "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}
    </div>
  )
}
