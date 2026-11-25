"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { PageContainer, PageHeader } from "@/components/ui/page"
import {
  DayToolbar,
  type StaffOption,
} from "@/components/appointments-day/day-toolbar"
import { DayTable } from "@/components/appointments-day/day-table"
import { DayKpis } from "@/components/appointments-day/day-kpis"
import { useCentroPantalla } from "@/hooks/use-centro-pantalla"
import { useMe } from "@/hooks/use-me"
import { useResource } from "@/hooks/use-resource"
import { useCitaStream } from "@/hooks/use-cita-stream"
import { useBookedBy, usePortfolioOwner } from "@/hooks/use-booked-by"
import { getAppointmentsDay, type DayListRow } from "@/lib/api/appointments-day"
import { listPersonalAll } from "@/lib/api/personal"
import { getTiposCita } from "@/lib/api/citas"
import { getServicios } from "@/lib/api/servicios"
import { myStaffId } from "@/lib/auth/who-did-it"
import {
  dayListSearch,
  nowInZone,
  parseDayScreenParams,
  pickedTypes,
  toDayScreenSearch,
  typeOptions as toTypeOptions,
  type DayScreenParams,
  type TypeOption,
} from "@/lib/appointments-day/day-list"
import { BUSINESS_TIME_ZONE } from "@/i18n/formats"

/** How often "now" moves on (late / upcoming), in ms. */
const MINUTE = 60_000

// Citas (/scheduling/booked): what is already booked for one day, both kinds, to confirm, change or
// cancel it; for today, who has arrived. One call: GET appointments/day. Every action button comes from
// the row's allowedActions. Spec docs/specs/citas-day-screen.md; API appointment-lifecycle-switch-fe.md.
// "Now" is the center's time: the FE does not receive a center's zone yet, so it is the business zone
// (America/Puerto_Rico), the same default the backend uses for a center without one.
export function AppointmentsDayScreen() {
  const t = useTranslations("appointmentsDay")
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), MINUTE)
    return () => window.clearInterval(id)
  }, [])
  const zoneNow = nowInZone(now, BUSINESS_TIME_ZONE)

  const params = parseDayScreenParams(
    new URLSearchParams(sp.toString()),
    zoneNow.day
  )
  const setParams = (next: Partial<DayScreenParams>) =>
    router.replace(`${pathname}?${toDayScreenSearch({ ...params, ...next })}`, {
      scroll: false,
    })
  const isToday = params.date === zoneNow.day

  // Every clinic the person reads by default; the Clinic filter narrows to one (`?clinic=`).
  const centro = useCentroPantalla("citas.read", "citas.update", null)
  const clinics = centro.centros
  const clinic =
    params.clinic && clinics.some((c) => c.id === params.clinic)
      ? params.clinic
      : null
  const centerIds = clinic ? [clinic] : clinics.map((c) => c.id)
  const centersKey = centerIds.join(",")
  // The header the guard checks: the picked clinic, else one the person reads (the list itself then
  // asks for no centerIds, so the backend reads every clinic the person can).
  const centerId = clinic ?? centerIds[0]
  const me = useMe()
  // undefined while `me` loads (the list waits: never All first, then Me); null = no staff record.
  const staffId =
    me.kind === "loading"
      ? undefined
      : me.kind === "ok"
        ? myStaffId(me.me)
        : null

  const staffRes = useResource<StaffOption[]>(
    () =>
      centerIds.length
        ? Promise.all(centerIds.map((id) => listPersonalAll({}, id))).then(
            (lists) =>
              uniqueById(
                lists
                  .flat()
                  .map((p) => ({
                    id: p.id,
                    name: [p.name, p.lastName].filter(Boolean).join(" "),
                  }))
                  .filter((p) => p.name)
              ).sort((a, b) => a.name.localeCompare(b.name))
          )
        : Promise.resolve([]),
    [centersKey]
  )
  const staff = staffRes.state.kind === "ok" ? staffRes.state.data : null
  // A failed staff list counts as no options (never null): a remembered person falls back to Me / All
  // and the day list still loads.
  const staffOptions =
    staffRes.state.kind === "fail" ? [] : (staff?.map((s) => s.id) ?? null)
  const [bookedBy, setBookedBy] = useBookedBy(staffId, staffOptions)
  const [owner, setOwner] = usePortfolioOwner(
    params.owner,
    (v) => setParams({ owner: v }),
    staffId,
    staffOptions
  )

  // The "Type" picker: the medical types and the services of the clinics shown. A failed read counts as no options
  // (never null): a type picked in the URL is dropped and the day list still loads.
  const typesRes = useResource<TypeOption[]>(
    () =>
      centerIds.length
        ? Promise.all([
            getTiposCita(),
            Promise.all(centerIds.map((id) => getServicios(id))),
          ]).then(([types, services]) =>
            toTypeOptions(types, uniqueById(services.flat()))
          )
        : Promise.resolve([]),
    [centersKey]
  )
  const options =
    typesRes.state.kind === "ok"
      ? typesRes.state.data
      : typesRes.state.kind === "fail"
        ? []
        : null
  const picked = pickedTypes(params.types, options)

  const search =
    bookedBy === null || owner === null || picked === null
      ? null
      : dayListSearch({
          ...params,
          centerId: clinic ?? undefined,
          bookedBy,
          portfolioOwner: owner,
          myStaffId: staffId,
          picked,
        }).toString()
  const res = useResource<DayListRow[]>(
    () =>
      centerId && search !== null
        ? getAppointmentsDay(new URLSearchParams(search), centerId)
        : Promise.resolve([]),
    [search, centerId]
  )

  // Until the screen's center is known, the list is loading (never an empty day that is not one).
  const state =
    (centro.cargando && !centerId) || (centerId && search === null)
      ? { kind: "loading" as const }
      : res.state

  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      {centerIds.map((id) => (
        <DayStream key={id} centerId={id} onInvalidate={res.refresh} />
      ))}

      <DayToolbar
        date={params.date}
        today={zoneNow.day}
        onDate={(date) => setParams({ date })}
        clinics={clinics}
        clinic={clinic}
        onClinic={(c) => setParams({ clinic: c })}
        typeOptions={options}
        types={params.types}
        onTypes={(types) => setParams({ types })}
        bookedBy={bookedBy}
        onBookedBy={setBookedBy}
        owner={owner}
        onOwner={setOwner}
        staff={staff ?? []}
        canBeMe={!!staffId}
        includeCancelled={params.includeCancelled}
        onIncludeCancelled={(includeCancelled) =>
          setParams({ includeCancelled })
        }
        kpis={
          <DayKpis
            rows={
              state.kind === "ok"
                ? state.data
                : state.kind === "fail"
                  ? "fail"
                  : null
            }
            nowHHmm={isToday ? zoneNow.hhmm : null}
          />
        }
      />

      <DayTable
        clinicNames={
          !clinic && clinics.length > 1
            ? new Map(clinics.map((c) => [c.id, c.name]))
            : null
        }
        state={state}
        nowHHmm={isToday ? zoneNow.hhmm : null}
        onReload={res.reload}
        onChanged={res.refresh}
      />
    </PageContainer>
  )
}

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  return [...new Map(list.map((x) => [x.id, x])).values()]
}

// Arrivals, confirmations and moves from other screens: one clinic's appointment and session events
// refetch the list (the events carry no allowedActions, so a refetch, never a patch). One per clinic shown.
function DayStream({
  centerId,
  onInvalidate,
}: {
  centerId: string
  onInvalidate: () => void
}) {
  useCitaStream({ centroId: centerId, onInvalidate })
  return null
}
