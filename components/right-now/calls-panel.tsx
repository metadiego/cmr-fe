"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { RightNowCalls } from "@/lib/api/right-now";
import { ratePct } from "@/lib/right-now/view";
import { Panel, Pill, RankBadge, Stat } from "@/components/right-now/parts";

// Calls: ONE call center for the whole org (BE #553, handoff .personal/handoff-extensiones-por-
// central.md) — same block whatever center the top bar has chosen. Reads ONLY `combinado.calls`, not
// `centers[].calls` (the BE still mirrors it onto the first center for a transition period; told the
// BE when this stopped mattering). A ranking row is a PERSON now (staffId), summed across both PBXes.
export function CallsPanel({ calls }: { calls: RightNowCalls | undefined }) {
  const t = useTranslations("rightNow.calls");
  const c = calls?.consolidated ?? { total: 0, inbound: 0, outbound: 0, missed: 0, answerRate: 0 };
  const byPbx = calls?.byPbx ?? [];
  const ranking = [...(calls?.ranking ?? [])].sort((a, b) => b.answered + b.outbound - (a.answered + a.outbound));

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
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("byPbx")}</div>
          {byPbx.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {byPbx.map((p) => (
                <div key={p.pbx} className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.pbx}</span>
                    <span className="text-lg font-bold tabular-nums">{p.total}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill tone="info">{p.inbound}↓</Pill>
                    <Pill>{p.outbound}↑</Pill>
                    <Pill tone={p.missed > 0 ? "destructive" : "muted"}>{p.missed} {t("missed").toLowerCase()}</Pill>
                    <Pill tone="success">{ratePct(p.answerRate)}%</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("ranking")}</div>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {ranking.slice(0, 8).map((r, i) => (
                <li key={r.staffId ?? r.extension} className="flex items-center gap-2 text-sm">
                  <RankBadge rank={i + 1} />
                  <span className="min-w-0 flex-1 truncate">
                    {r.name ? (
                      <>
                        {r.name}
                        <span className="ml-1 text-xs text-muted-foreground">#{r.extension}</span>
                      </>
                    ) : (
                      <Link href="/configuration/staff" className="text-primary hover:underline">
                        {t("unassigned", { extension: r.extension })}
                      </Link>
                    )}
                  </span>
                  <Pill tone="success">{r.answered} {t("colAnswered")}</Pill>
                  <Pill tone="info">{r.outbound} {t("colOutbound")}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
