"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { RightNowCenter } from "@/lib/api/right-now";
import { getFacturasTablero, type FacturaTableroFila } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";
import { attendedSplit, topSellers } from "@/lib/right-now/view";
import { Empty, Panel, Pill, RankBadge, Stat } from "@/components/right-now/parts";
import { ServicesPanel } from "@/components/right-now/services-panel";
import { Tooltip } from "@/components/ui/tooltip";

// One center's column on the «Ahora mismo» board, as the legacy screen had it: sales, consultation
// patients, the doctors' ranking, prescriptions (shown even while empty) and the services.
export function CenterColumn({ center, now }: { center: RightNowCenter; now: number }) {
  const t = useTranslations("rightNow");
  // El BE manda `labelKey` de la fila "sin médico" YA calificado (`rightNow.doctors.noDoctor`), igual
  // que el resto del motor de tableros — se resuelve con el traductor raíz, no el de este namespace.
  const tRoot = useTranslations();
  const sales = center.sales;
  const split = attendedSplit(center.patients);
  const sellers = topSellers(sales);
  const doctors = center.doctors ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        {center.name}
      </h2>

      <Panel title={t("sales.title")} aside={<span className="text-xs text-muted-foreground">{t("sales.refunds", { n: sales?.refunds ?? 0 })}</span>}>
        <Stat label={t("sales.net")} value={money(sales?.neto ?? 0)} size="lg" />
        <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("sales.topSellers")}</div>
        {sellers.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("sales.noSellers")}</p>
        ) : (
          <ol className="mt-1.5 space-y-1.5">
            {sellers.map((s, i) => (
              <li key={s.userId} className="flex items-center gap-2 text-sm">
                <RankBadge rank={i + 1} />
                <span className="min-w-0 flex-1 truncate">{s.name ?? t("sales.unknownSeller")}</span>
                <span className="tabular-nums font-semibold">{money(s.total)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title={t("patients.title")}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("patients.present")} value={center.patients?.present ?? 0} />
          <Stat label={t("patients.firstVisit")} value={center.patients?.firstVisit ?? 0} />
          <Stat label={t("patients.followUp")} value={center.patients?.followUp ?? 0} />
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-emerald-500" style={{ width: `${split.attendedPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${split.pendingPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs">
          <span className="text-emerald-700 dark:text-emerald-400">{t("patients.attended")}: <b className="tabular-nums">{split.attended}</b></span>
          <span className="text-amber-700 dark:text-amber-400">{t("patients.pending")}: <b className="tabular-nums">{split.pending}</b></span>
        </div>
      </Panel>

      <Panel title={t("doctors.title")}>
        {doctors.length === 0 ? (
          <Empty>{t("doctors.empty")}</Empty>
        ) : (
          <ul className="space-y-2">
            {doctors.map((d, i) => {
              // Fila de cierre "lo facturado sin médico" (handoff-ahora-mismo-sin-medico): sin
              // ranking (no es un médico) y atenuada; sin ella, la columna Facturado no sumaba la
              // venta del día completa.
              const sinMedico = !!d.labelKey;
              return (
                <li key={d.doctorId ?? "no-doctor"} className="flex items-center gap-2 text-sm">
                  {sinMedico ? <span className="size-5 shrink-0" aria-hidden /> : <RankBadge rank={i + 1} />}
                  <span className={cn("min-w-0 flex-1 truncate", sinMedico && "italic text-muted-foreground")}>
                    {sinMedico ? tRoot(d.labelKey!) : (d.name ?? "—")}
                  </span>
                  {!sinMedico && (
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      <Pill>{d.total} {t("doctors.colTotal")}</Pill>
                      <Pill tone="success">{d.attended} {t("doctors.colAttended")}</Pill>
                      <Pill tone="info">{d.firstVisit} {t("doctors.colFirst")}</Pill>
                      <Pill>{d.followUp} {t("doctors.colFollow")}</Pill>
                    </span>
                  )}
                  <span className="shrink-0 text-right font-semibold tabular-nums">
                    {sinMedico ? (
                      <Tooltip content={<PendingDoctorList clinicId={center.clinicId} date={center.date} />}>
                        <span className="cursor-help underline decoration-dotted underline-offset-2">
                          {money(d.net)}
                        </span>
                      </Tooltip>
                    ) : (
                      money(d.net)
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <ServicesPanel services={center.services} now={now} />

      <Panel title={t("prescriptions.title")}>
        {center.prescriptions?.available && (center.prescriptions.ranking ?? []).length > 0 ? (
          <ol className="space-y-1 text-sm">
            {(center.prescriptions.ranking ?? []).map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{r.name ?? "—"}</span>
                <span className="tabular-nums">{r.total ?? 0}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{t("prescriptions.empty")}</Empty>
        )}
      </Panel>
    </div>
  );
}

// Contenido del hover sobre el "Facturado" de la fila "Sin médico": qué facturas de HOY no tienen
// médico, para que el mostrador pueda ir a corregirlas. Se arma client-side con el tablero de
// facturas (ya resuelve el nombre del paciente); no hace falta nada nuevo del BE. Se dispara perezoso
// (la petición no corre hasta que el Tooltip la monta, al primer hover/foco).
function PendingDoctorList({ clinicId, date }: { clinicId: string; date: string }) {
  const t = useTranslations("rightNow.doctors");
  const { state } = useResource<FacturaTableroFila[]>(
    () =>
      getFacturasTablero({ from: date, to: date, limit: 100 }, clinicId).then((b) =>
        b.rows.filter((r) => r["fac_medico__valor"] == null),
      ),
    [clinicId, date],
  );
  if (state.kind === "loading") return <p>{t("pendingDoctorLoading")}</p>;
  const rows = state.kind === "ok" ? state.data : [];
  return (
    <div className="max-w-full">
      <p className="mb-1 font-medium not-italic">{t("pendingDoctor")}</p>
      {rows.length === 0 ? (
        <p className="not-italic">{t("pendingDoctorEmpty")}</p>
      ) : (
        <ul className="space-y-0.5 not-italic">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3">
              <span className="truncate">
                #{String(r["fac_numero"] ?? "—")} · {String(r["fac_paciente"] ?? "—")}
              </span>
              <span className="shrink-0 tabular-nums">{money(Number(r["fac_total"] ?? 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
