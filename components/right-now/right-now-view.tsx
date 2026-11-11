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
import { cn } from "@/lib/utils";
import { CenterColumn } from "@/components/right-now/center-column";
import { CallsPanel } from "@/components/right-now/calls-panel";
import { ExternalSourceSettingsButton } from "@/components/right-now/external-source-settings";

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
        // El interruptor del enchufe del legado vive lejos de los usuarios de esta pantalla a
        // propósito (handoff .personal/handoff-ahora-mismo-legado-bayamon.md): un botón aparte,
        // visible solo con ahora-mismo.config — nunca entre las cifras que todos miran.
        actions={
          ready && can("ahora-mismo.config") && centers.length > 0 ? (
            <ExternalSourceSettingsButton centerIds={centers.map((c) => c.clinicId)} />
          ) : undefined
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
          <section className="overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm">
            <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/70">{t("combined")}</div>
            <div className="grid grid-cols-2 gap-px bg-primary-foreground/10 p-px sm:grid-cols-4 xl:grid-cols-8">
              <KpiTile label={t("kpi.netSales")} value={money(combined?.sales?.neto ?? 0)} />
              <KpiTile label={t("kpi.invoices")} value={combined?.sales?.invoices ?? 0} />
              <KpiTile label={t("kpi.refunds")} value={combined?.sales?.refunds ?? 0} dim />
              <KpiTile label={t("kpi.present")} value={combined?.patients?.present ?? 0} />
              <KpiTile label={t("kpi.attended")} value={combined?.patients?.attended ?? 0} accent="success" />
              <KpiTile label={t("kpi.pending")} value={combined?.patients?.pending ?? 0} accent="warning" />
              <KpiTile label={t("kpi.calls")} value={combined?.calls?.consolidated?.total ?? 0} accent="info" />
              <KpiTile label={t("kpi.alerts")} value={combined?.alerts?.total ?? 0} accent={(combined?.alerts?.total ?? 0) > 0 ? "destructive" : undefined} />
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

          <CallsPanel calls={combined?.calls} />
        </>
      )}
    </PageContainer>
  );
}

// One number in the combined banner: on the `bg-primary` strip, so a plain muted-foreground label
// would vanish — every tile gets its own slightly-lighter backing instead of the page's card color,
// and `accent` tints the VALUE for the ones that mean something is wrong/pending (never the label).
function KpiTile({
  label,
  value,
  accent,
  dim,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  accent?: "success" | "warning" | "destructive" | "info";
  dim?: boolean;
}) {
  const accentCls =
    accent === "success"
      ? "text-emerald-300"
      : accent === "warning"
        ? "text-amber-300"
        : accent === "destructive"
          ? "text-red-300"
          : accent === "info"
            ? "text-sky-300"
            : "text-primary-foreground";
  return (
    <div className="min-w-0 bg-primary px-4 py-3">
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-primary-foreground/60">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", dim ? "text-primary-foreground/50" : accentCls)}>{value}</div>
    </div>
  );
}
