"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getCallStatistics, getLiveCalls, getMissedReport, getPushHealth } from "@/lib/api/callcenter";
import { pbxParam, quickRange, type CallcenterPbx } from "@/lib/comunicaciones/callcenter-dashboard";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { LoadingPanel, ErrorState } from "@/components/kit/panel";
import { CallcenterLagBanner } from "@/components/comunicaciones/callcenter/callcenter-lag-banner";
import { CallcenterLivePanel } from "@/components/comunicaciones/callcenter/callcenter-live-panel";
import { Callcenter3cxPanel } from "@/components/comunicaciones/callcenter/callcenter-3cx-panel";
import { CallcenterPbxSelector } from "@/components/comunicaciones/callcenter/callcenter-pbx-selector";
import { CallcenterStatsSection } from "@/components/comunicaciones/callcenter/callcenter-stats-section";
import { CallcenterCallsTable } from "@/components/comunicaciones/callcenter/callcenter-calls-table";
import { CallcenterMissedReport } from "@/components/comunicaciones/callcenter/callcenter-missed-report";

type RangeKind = "today" | "week" | "range";
type Section = "calls" | "missed";

export default function CallcenterPage() {
  const t = useTranslations("callcenter");
  const router = useRouter();
  const { can, ready } = useCan();

  const [rangeKind, setRangeKind] = React.useState<RangeKind>("today");
  const today = React.useMemo(() => quickRange("today", new Date()), []);
  const [customFrom, setCustomFrom] = React.useState(today.from);
  const [customTo, setCustomTo] = React.useState(today.to);
  const { from, to } = rangeKind === "range" ? { from: customFrom, to: customTo } : quickRange(rangeKind, new Date());

  // Default UCM Bayamón (handoff §1): it matches the legacy screen's own count exactly; "Todas" is
  // today's prior combined behaviour. The 3CX panel below is independent of this — always 3CX, always today.
  const [pbx, setPbx] = React.useState<CallcenterPbx>("ucm-bayamon");
  const [section, setSection] = React.useState<Section>("calls");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const statsKey = `${from}|${to}|${pbx}`;
  const { state: statsState, refresh: refreshStats } = useResource(() => getCallStatistics(from, to, pbxParam(pbx), null), [statsKey]);
  const { state: missedState, refresh: refreshMissed } = useResource(
    () => (section === "missed" ? getMissedReport(from, to, undefined, pbxParam(pbx), null) : Promise.resolve(null)),
    [statsKey, section],
  );
  const { state: liveState, refresh: refreshLive } = useResource(() => getLiveCalls(null), []);
  const { state: healthState, refresh: refreshHealth } = useResource(() => getPushHealth(null), []);

  // One combined bus (handoff §5): a `llamada` event refreshes every section on screen, debounced ~2s
  // by useCitaStream — the agent sends batches, one refetch per batch, not one per row.
  useCitaStream({
    centroId: null,
    entidad: "llamada",
    path: "/api/v2/callcenter/stream",
    debounceMs: 2000,
    onInvalidate: () => {
      refreshStats();
      refreshMissed();
      refreshLive();
      refreshHealth();
      setRefreshKey((k) => k + 1); // also nudges the calls table's own useResource key
    },
  });

  if (ready && !can("callcenter.read")) {
    return <PageContainer className="text-center text-sm text-muted-foreground">{t("noPermission")}</PageContainer>;
  }

  const health = healthState.kind === "ok" ? healthState.data : [];
  const live = liveState.kind === "ok" ? liveState.data : [];

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      <CallcenterLagBanner health={health} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "range"] as const).map((k) => (
            <Button key={k} size="sm" variant={rangeKind === k ? "default" : "outline"} onClick={() => setRangeKind(k)}>
              {t(`range.${k}`)}
            </Button>
          ))}
          {rangeKind === "range" && (
            <>
              <DatePicker value={customFrom} onChange={setCustomFrom} className="h-9 w-[150px]" />
              <DatePicker value={customTo} min={customFrom} onChange={setCustomTo} className="h-9 w-[150px]" />
            </>
          )}
        </div>
        <CallcenterPbxSelector value={pbx} onChange={setPbx} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {statsState.kind === "loading" && <LoadingPanel rows={3} />}
          {statsState.kind === "fail" && <ErrorState message={statsState.message} />}
          {statsState.kind === "ok" && <CallcenterStatsSection stats={statsState.data} />}

          <SegmentedControl
            ariaLabel={t("sectionAriaLabel")}
            value={section}
            onChange={setSection}
            options={[
              { value: "calls", label: t("sectionCalls") },
              { value: "missed", label: t("sectionMissed") },
            ]}
            className="max-w-sm"
          />

          {section === "calls" && (
            <CallcenterCallsTable from={from} to={to} pbx={pbx} refreshKey={refreshKey} onOpenPatient={(id) => router.push(`/patients/${id}`)} />
          )}
          {section === "missed" && (
            <>
              {missedState.kind === "loading" && <LoadingPanel rows={3} />}
              {missedState.kind === "fail" && <ErrorState message={missedState.message} />}
              {missedState.kind === "ok" && missedState.data && <CallcenterMissedReport report={missedState.data} />}
            </>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <CallcenterLivePanel calls={live} />
          <Callcenter3cxPanel from={today.from} refreshKey={refreshKey} />
        </div>
      </div>
    </PageContainer>
  );
}
