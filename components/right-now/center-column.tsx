"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { RightNowCenter } from "@/lib/api/right-now";
import { money } from "@/lib/caja/totales";
import { attendedSplit, topSellers } from "@/lib/right-now/view";
import { Empty, Panel, Stat } from "@/components/right-now/parts";
import { ServicesPanel } from "@/components/right-now/services-panel";

// One center's column on the «Ahora mismo» board, as the legacy screen had it: sales, consultation
// patients, the doctors' ranking, prescriptions (shown even while empty) and the services.
export function CenterColumn({ center, now }: { center: RightNowCenter; now: number }) {
  const t = useTranslations("rightNow");
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
          <ol className="mt-1 space-y-1 text-sm">
            {sellers.map((s, i) => (
              <li key={s.userId} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {s.name ?? t("sales.unknownSeller")}
                </span>
                <span className="tabular-nums font-medium">{money(s.total)}</span>
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
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-1.5 font-medium">{t("doctors.colDoctor")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("doctors.colTotal")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("doctors.colAttended")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("doctors.colFirst")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t("doctors.colFollow")}</th>
                  <th className="px-4 py-1.5 text-right font-medium">{t("doctors.colNet")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {doctors.map((d, i) => (
                  <tr key={d.doctorId}>
                    <td className="px-4 py-1.5">
                      <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                      {d.name ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{d.total}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{d.attended}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{d.firstVisit}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{d.followUp}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{money(d.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
