"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PageContainer, PageHeader } from "@/components/ui/page";
import { Panel, Stat, StatGrid } from "@/components/kit/panel";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { LiveBadge } from "@/components/live-badge";
import { DayToolbar, type StaffOption } from "@/components/appointments-day/day-toolbar";
import { DayTable } from "@/components/appointments-day/day-table";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useBookedBy, usePortfolioOwner } from "@/hooks/use-booked-by";
import { getAppointmentsDay, type DayListRow } from "@/lib/api/appointments-day";
import { listPersonalAll } from "@/lib/api/personal";
import { getTiposCita } from "@/lib/api/citas";
import { getServicios } from "@/lib/api/servicios";
import { myStaffId } from "@/lib/auth/who-did-it";
import {
  dayListSearch,
  keepByBucket,
  nowInZone,
  parseDayScreenParams,
  pickedTypes,
  pruneTypes,
  todaySummary,
  toDayScreenSearch,
  typeOptions as toTypeOptions,
  typeOptionsForBucket,
  type DayScreenParams,
  type TypeOption,
} from "@/lib/appointments-day/day-list";
import { BUSINESS_TIME_ZONE } from "@/i18n/formats";

/** How often "now" moves on (late / upcoming), in ms. */
const MINUTE = 60_000;

// Citas (/scheduling/booked): what is already booked for one day, both kinds, to confirm, change or
// cancel it; for today, who has arrived. One call: GET appointments/day. Every action button comes from
// the row's allowedActions. Spec docs/specs/citas-day-screen.md; API appointment-lifecycle-switch-fe.md.
// "Now" is the center's time: the FE does not receive a center's zone yet, so it is the business zone
// (America/Puerto_Rico), the same default the backend uses for a center without one.
export function AppointmentsDayScreen() {
  const t = useTranslations("appointmentsDay");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE);
    return () => window.clearInterval(id);
  }, []);
  const zoneNow = nowInZone(now, BUSINESS_TIME_ZONE);

  const params = parseDayScreenParams(new URLSearchParams(sp.toString()), zoneNow.day);
  const setParams = (next: Partial<DayScreenParams>) =>
    router.replace(`${pathname}?${toDayScreenSearch({ ...params, ...next })}`, { scroll: false });
  const isToday = params.date === zoneNow.day;

  const centro = useCentroPantalla("citas.read", "citas.update", sp.get("centro"));
  const centerId = centro.centroActivo || undefined;
  const me = useMe();
  // undefined while `me` loads (the list waits: never All first, then Me); null = no staff record.
  const staffId = me.kind === "loading" ? undefined : me.kind === "ok" ? myStaffId(me.me) : null;

  const staffRes = useResource<StaffOption[]>(
    () =>
      centerId
        ? listPersonalAll({}, centerId)
            .then((list) =>
              list
                .map((p) => ({ id: p.id, name: [p.name, p.lastName].filter(Boolean).join(" ") }))
                .filter((p) => p.name)
                .sort((a, b) => a.name.localeCompare(b.name)),
            )
        : Promise.resolve([]),
    [centerId],
  );
  const staff = staffRes.state.kind === "ok" ? staffRes.state.data : null;
  // A failed staff list counts as no options (never null): a remembered person falls back to Me / All
  // and the day list still loads.
  const staffOptions = staffRes.state.kind === "fail" ? [] : (staff?.map((s) => s.id) ?? null);
  const [bookedBy, setBookedBy] = useBookedBy(staffId, staffOptions);
  const [owner, setOwner] = usePortfolioOwner(params.owner, (v) => setParams({ owner: v }), staffId, staffOptions);

  // The "Type" picker: the medical types and this center's services. A failed read counts as no options
  // (never null): a type picked in the URL is dropped and the day list still loads.
  const typesRes = useResource<TypeOption[]>(
    () =>
      centerId
        ? Promise.all([getTiposCita(), getServicios(centerId)]).then(([types, services]) => toTypeOptions(types, services))
        : Promise.resolve([]),
    [centerId],
  );
  const options = typesRes.state.kind === "ok" ? typesRes.state.data : typesRes.state.kind === "fail" ? [] : null;
  const picked = pickedTypes(params.types, options, params.bucket);

  const search =
    bookedBy === null || owner === null || picked === null
      ? null
      : dayListSearch({ ...params, centerId, bookedBy, portfolioOwner: owner, myStaffId: staffId, picked }).toString();
  const res = useResource<DayListRow[]>(
    () => (centerId && search !== null ? getAppointmentsDay(new URLSearchParams(search), centerId) : Promise.resolve([])),
    [search, centerId],
  );
  // Arrivals, confirmations and moves from other screens: the appointment and session events of this
  // center refetch the list (the events carry no allowedActions, so a refetch, never a patch).
  const { live } = useCitaStream({ centroId: centerId ?? null, enabled: !!centerId, onInvalidate: res.refresh });

  // Until the screen's center is known, the list is loading (never an empty day that is not one).
  const state =
    (centro.cargando && !centerId) || (centerId && search === null)
      ? { kind: "loading" as const }
      : res.state.kind === "ok"
        ? { kind: "ok" as const, data: keepByBucket(res.state.data, params.bucket) }
        : res.state;
  const summary = isToday && state.kind === "ok" ? todaySummary(state.data, zoneNow.hhmm) : null;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {live ? <LiveBadge label={t("live")} /> : <span className="text-xs text-muted-foreground">{t("offline")}</span>}
            <CentroPantallaSelector estado={centro} />
          </>
        }
      />

      <DayToolbar
        date={params.date}
        today={zoneNow.day}
        onDate={(date) => setParams({ date })}
        bucket={params.bucket}
        onBucket={(bucket) => setParams({ bucket, types: pruneTypes(params.types, options, bucket) })}
        typeOptions={options && typeOptionsForBucket(options, params.bucket)}
        types={params.types}
        onTypes={(types) => setParams({ types })}
        bookedBy={bookedBy}
        onBookedBy={setBookedBy}
        owner={owner}
        onOwner={setOwner}
        staff={staff ?? []}
        canBeMe={!!staffId}
        includeCancelled={params.includeCancelled}
        onIncludeCancelled={(includeCancelled) => setParams({ includeCancelled })}
      />

      {summary && (
        <Panel title={t("summary.title")}>
          <StatGrid cols={3}>
            <Stat label={t("summary.arrived")} value={summary.arrived} tone="primary" />
            <Stat label={t("summary.late")} value={summary.late} tone={summary.late > 0 ? "danger" : "muted"} />
            <Stat label={t("summary.upcoming")} value={summary.upcoming} />
          </StatGrid>
        </Panel>
      )}

      <DayTable state={state} nowHHmm={isToday ? zoneNow.hhmm : null} onReload={res.reload} onChanged={res.refresh} />
    </PageContainer>
  );
}
