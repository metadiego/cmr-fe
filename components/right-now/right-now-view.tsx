"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getRightNowCenters, RIGHT_NOW_STREAM_PATH, type RightNowCenters } from "@/lib/api/right-now";
import { money } from "@/lib/caja/totales";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useCitaStream as useLiveStream } from "@/hooks/use-cita-stream";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveBadge } from "@/components/live-badge";
import { Stat } from "@/components/right-now/parts";
import { CenterColumn } from "@/components/right-now/center-column";
import { CallsPanel } from "@/components/right-now/calls-panel";

// «Ahora mismo» — every office live, the legacy board rebuilt on the current design, full screen:
// combined totals on top, then one column per center (from /right-now/centers, never a hardcoded
// list), then calls. Refreshed by the /right-now/stream SSE (debounced), not by polling: the quota is
// per person (handoff right-now-office-dashboard.md). Needs `ahora-mismo.read`.
export function RightNowView() {
  const t = useTranslations("rightNow");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { can, ready } = useCan();
  const allowed = ready && can("ahora-mismo.read");

  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);
  const res = useResource<RightNowCenters | null>(
    () =>
      allowed
        ? getRightNowCenters().then((d) => {
            setUpdatedAt(Date.now()); // stamp each new snapshot
            return d;
          })
        : Promise.resolve(null),
    [allowed],
  );
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000); // waiting minutes keep moving
    return () => clearInterval(id);
  }, []);
  const data = res.state.kind === "ok" ? res.state.data : null;

  const { refresh } = res;
  const { live } = useLiveStream({
    centroId: null, // combined scope: every center the user may read
    enabled: allowed,
    path: RIGHT_NOW_STREAM_PATH,
    debounceMs: 800,
    onInvalidate: refresh,
  });

  if (ready && !allowed) return <p className="p-6 text-sm text-muted-foreground">{tc("forbidden")}</p>;

  const combined = data?.combinado;
  const centers = data?.centers ?? [];

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={t("description")}
        count={
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            {live ? <LiveBadge label={t("live")} /> : <span>{t("offline")}</span>}
            {updatedAt && <span>{t("updatedAt", { time: format.dateTime(new Date(updatedAt), "time") })}</span>}
          </span>
        }
      />

      {res.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{t("error")} — {res.state.message}</p>
      ) : !data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-24 xl:col-span-2" />
          <Skeleton className="h-[32rem]" />
          <Skeleton className="h-[32rem]" />
        </div>
      ) : (
        <>
          <section className="rounded-lg bg-card p-4 ring-1 ring-foreground/10 shadow-sm">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("combined")}</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
              <Stat label={t("kpi.netSales")} value={money(combined?.sales?.neto ?? 0)} />
              <Stat label={t("kpi.invoices")} value={combined?.sales?.invoices ?? 0} />
              <Stat label={t("kpi.refunds")} value={combined?.sales?.refunds ?? 0} tone="muted" />
              <Stat label={t("kpi.present")} value={combined?.patients?.present ?? 0} />
              <Stat label={t("kpi.attended")} value={combined?.patients?.attended ?? 0} tone="success" />
              <Stat label={t("kpi.pending")} value={combined?.patients?.pending ?? 0} tone="warning" />
              <Stat label={t("kpi.calls")} value={combined?.calls?.consolidated?.total ?? 0} />
              <Stat label={t("kpi.alerts")} value={combined?.alerts?.total ?? 0} tone={(combined?.alerts?.total ?? 0) > 0 ? "warning" : "muted"} />
            </div>
          </section>

          {centers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCenters")}</p>
          ) : (
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 34rem), 1fr))` }}
            >
              {centers.map((c) => (
                <CenterColumn key={c.clinicId} center={c} now={now} />
              ))}
            </div>
          )}

          <CallsPanel consolidated={combined?.calls?.consolidated} centers={centers} />
        </>
      )}
    </PageContainer>
  );
}
