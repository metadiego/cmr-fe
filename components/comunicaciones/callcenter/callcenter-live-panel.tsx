"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { LiveCall } from "@/lib/api/callcenter";
import { isLiveRowStale } from "@/lib/comunicaciones/callcenter-dashboard";
import { Panel, EmptyState } from "@/components/kit/panel";

// Handoff §4 (`GET /callcenter/live-at`, already existed): one row per extension, overwritten by the
// agent's last heartbeat. A stale `agentReportedAt` shows "no data," never a stale timestamp dressed
// up as live — the agent process can die silently otherwise.
export function CallcenterLivePanel({ calls }: { calls: LiveCall[] }) {
  const t = useTranslations("callcenter");
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel title={t("liveTitle")}>
      {calls.length === 0 ? (
        <EmptyState>{t("liveEmpty")}</EmptyState>
      ) : (
        <ul className="divide-y">
          {calls.map((c) => {
            const stale = isLiveRowStale(c.agentReportedAt, now);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{t("extension", { extension: c.extension })}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.clinicName ?? "—"}
                    {c.from ? ` · ${c.from}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {stale ? t("liveNoData") : t("liveStatus", { status: c.status, seconds: c.elapsedSeconds })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
