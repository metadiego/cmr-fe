"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { RightNowCenter, RightNowCallTotals } from "@/lib/api/right-now";
import { ratePct } from "@/lib/right-now/view";
import { Panel, Stat } from "@/components/right-now/parts";

// Calls across centers: the consolidated totals, each PBX, and the operators' ranking (named by the
// staff record's extension). Shown with its zeros until the PBX agent pushes calls (handoff).
export function CallsPanel({ consolidated, centers }: { consolidated: RightNowCallTotals | undefined; centers: RightNowCenter[] }) {
  const t = useTranslations("rightNow.calls");
  const c = consolidated ?? { total: 0, inbound: 0, outbound: 0, missed: 0, answerRate: 0 };
  const byPbx = centers.flatMap((x) => x.calls?.byPbx ?? []);
  const ranking = centers
    .flatMap((x) => x.calls?.ranking ?? [])
    .sort((a, b) => b.answered + b.outbound - (a.answered + a.outbound));

  return (
    <Panel title={t("title")}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label={t("total")} value={c.total} />
        <Stat label={t("inbound")} value={c.inbound} />
        <Stat label={t("outbound")} value={c.outbound} />
        <Stat label={t("missed")} value={c.missed} tone={c.missed > 0 ? "destructive" : "muted"} />
        <Stat label={t("answerRate")} value={`${ratePct(c.answerRate)}%`} tone={c.total > 0 ? "success" : "muted"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("byPbx")}</div>
          {byPbx.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {byPbx.map((p) => (
                <li key={p.pbx} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="font-medium">{p.pbx}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.total} · {p.inbound}↓ {p.outbound}↑ · {p.missed} {t("missed").toLowerCase()} · {ratePct(p.answerRate)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ranking")}</div>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 font-medium">{t("colExtension")}</th>
                  <th className="py-1 font-medium">{t("colName")}</th>
                  <th className="py-1 text-right font-medium">{t("colAnswered")}</th>
                  <th className="py-1 text-right font-medium">{t("colOutbound")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ranking.map((r) => (
                  <tr key={r.extension}>
                    <td className="py-1.5 tabular-nums text-muted-foreground">{r.extension}</td>
                    <td className="py-1.5">{r.name ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.answered}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.outbound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Panel>
  );
}
