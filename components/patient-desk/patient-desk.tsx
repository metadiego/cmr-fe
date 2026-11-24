"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Calendar03Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import {
  filterByConsultationSubtype,
  sortByArrival,
  asConsultationView,
  filterByKind,
  filterByService,
  filterByServiceArrivedPending,
  filterPatients,
  orderSections,
  servicesOfTheDay,
  type PatientKind,
} from "@/lib/frontdesk/patient-day"
import { useMyFrontdeskPreference } from "@/hooks/use-frontdesk-default-tab"
import { cn } from "@/lib/utils"
import { usePatientDay, useServiceBoards } from "@/hooks/use-patient-day"
import { useCentroGate as useCenterGate } from "@/hooks/use-centro-gate"
import { useCan } from "@/hooks/use-can"
import { todayISO } from "@/components/frontdesk/frontdesk-board.helpers"
import { UbicacionEnVivoWidget as LiveLocationWidget } from "@/components/frontdesk/ubicacion-en-vivo-widget"
import { MedicosLibresWidget } from "@/components/frontdesk/medicos-libres-widget"
import { NurseStatusButton } from "@/components/frontdesk/nurse-status-button"
import { TechnicianStatusButton } from "@/components/frontdesk/technician-status-button"
import { TherapyBookingForm } from "@/components/patient-desk/therapy-booking-form"
import { BoardAppointmentModal } from "@/components/tablero/board-appointment-modal"
import { CentroPicker as CenterPicker } from "@/components/facturacion/centro-picker"
import { PatientListView } from "@/components/patient-desk/patient-list-view"
import { TherapyQueueStrip } from "@/components/patient-desk/therapy-queue-strip"
import { PatientDeskSkeleton } from "@/components/patient-desk/patient-desk-skeleton"
import { ServiceFilterDropdown, consultSubtypeLabel, type ServiceOfTheDay } from "@/components/patient-desk/service-filter-dropdown"
import { DaySummaryDialog } from "@/components/patient-desk/day-summary-dialog"
import type { ScheduleRequest } from "@/components/patient-desk/patient-detail"
import { EnTerapiaSinAsistirBanner } from "@/components/frontdesk/en-terapia-sin-asistir-banner"
import { PageContainer, PageHeader } from "@/components/ui/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { tinteFila } from "@/lib/agenda/tinte-tipo"

// Patient desk — the frontdesk turned around (alternative to /boards/frontdesk, which stays as is):
// the day's patients first, services and consultation together; pick one to see and work all their
// services, each with its own columns: the day's patients on the left, the selected one on the right
// (the owner picked this layout over an expandable table, 10-oct-2026). The center is the one picked in
// the top bar — no second selector here.
export function PatientDesk() {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  const { can } = useCan()
  const gate = useCenterGate()
  const router = useRouter()
  // Leído UNA vez al montar (lazy initializers) y re-escrito en la URL abajo — mismo patrón que
  // FacturasListView: así "Ficha" (Link, no recarga) + el "Volver" de la ficha (router.back())
  // restauran esta pantalla EXACTAMENTE como estaba, en vez de los valores por defecto (13-oct-2026).
  const initialParams = useSearchParams()
  // Restaurar TODO lo de arriba sirve para volver de una ficha abierta HOY — no para heredar el
  // filtro de ayer en una pestaña que quedó abierta (o una URL vieja): si la fecha en la URL no es
  // HOY, se ignoran kind/subtype/service/query/selección y se arranca en limpio (handoff
  // quejas-de-mostrador-2026-10-20 §3 — el tablero debe abrir siempre en «Todos los tipos»).
  const freshToday =
    !initialParams.get("date") || initialParams.get("date") === todayISO()

  const [date, setDate] = React.useState(
    () => initialParams.get("date") ?? todayISO()
  )
  const [query, setQuery] = React.useState(() =>
    freshToday ? (initialParams.get("q") ?? "") : ""
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    freshToday ? initialParams.get("p") : null
  )
  const [schedule, setSchedule] = React.useState<
    (ScheduleRequest & { open: boolean }) | { open: false }
  >({ open: false })
  const [addingConsultation, setAddingConsultation] = React.useState<
    | { open: true; pacienteId?: string; pacienteNombre?: string }
    | { open: false }
  >({ open: false })

  const day = usePatientDay(gate.centro, date)
  // Services / consultation / all. Starts on consultation for whoever has «lands on Consulta» in their
  // staff record (the reception people, set per person in the staff screen — not a role list here).
  const preference = useMyFrontdeskPreference(gate.centro)
  const [kindPicked, setKindPicked] = React.useState<PatientKind | null>(() => {
    if (!freshToday) return null
    const k = initialParams.get("kind")
    return k === "all" || k === "services" || k === "consultation" ? k : null
  })
  const kind: PatientKind =
    kindPicked ??
    (preference.state.kind === "ok" &&
    preference.state.data?.frontdeskStartsOnConsultation
      ? "consultation"
      : "all")
  // Sub-filter WITHIN the active kind: one service ("Servicios") or one subtype ("Consulta") — both
  // data-driven (servicesOfTheDay / the board's own subtype catalog), never a hardcoded list. Cleared
  // whenever the kind itself changes, so the little arrow never carries a stale, invisible filter.
  const [serviceFilter, setServiceFilter] = React.useState<string | null>(() =>
    freshToday ? initialParams.get("service") : null
  )
  const [consultSubtypeFilter, setConsultSubtypeFilter] = React.useState<
    string | null
  >(() => (freshToday ? initialParams.get("subtype") : null))
  // Narrows the service filter further to "arrived but not yet attended" — the owner's N=presente/
  // N=asistidos gap (06-nov-2026), one click away from the dropdown's own counts.
  const [serviceArrivedPending, setServiceArrivedPending] = React.useState(false)
  const pickServiceFilter = (serviceId: string | null, pendingOnly = false) => {
    setServiceFilter(serviceId)
    setServiceArrivedPending(serviceId ? pendingOnly : false)
  }
  const pickKind = (k: PatientKind) => {
    setKindPicked(k)
    setServiceFilter(null)
    setServiceArrivedPending(false)
    setConsultSubtypeFilter(null)
  }
  // A patient clicked in the therapy queue (owner, 23-nov-2026: "que filtre y traiga el paciente para
  // que vaya más rápido") — the queue is always a therapy, never a consultation, so "services" with no
  // sub-filter is the one kind guaranteed to show them, whatever the screen was filtered to before.
  const selectFromQueue = (patientId: string) => {
    pickKind("services")
    setQuery("")
    setSelectedId(patientId)
  }
  const [summaryOf, setSummaryOf] = React.useState<ServiceOfTheDay | null>(null)
  const servicesToday = React.useMemo(
    () => servicesOfTheDay(day.patients),
    [day.patients]
  )
  const consultSubtypes = React.useMemo(
    () =>
      [...(day.consultationDefinition?.subtypes ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    [day.consultationDefinition]
  )
  const patients = React.useMemo(() => {
    let list = filterByKind(day.patients, kind)
    const serviceFiltered = kind === "services" && !!serviceFilter
    if (serviceFiltered) {
      list =
        serviceArrivedPending
          ? filterByServiceArrivedPending(list, serviceFilter!)
          : filterByService(list, serviceFilter!)
    }
    if (kind === "consultation")
      list = sortByArrival(
        filterByConsultationSubtype(list, consultSubtypeFilter).map(
          asConsultationView
        )
      )
    // Pending sections first, unless a service filter sets the order (handoff lo-pendiente-primero).
    list = orderSections(list, {
      serviceFiltered,
      isTerminal: day.isConsultationTerminal,
    })
    return filterPatients(list, query)
  }, [
    day.patients,
    day.isConsultationTerminal,
    kind,
    serviceFilter,
    serviceArrivedPending,
    consultSubtypeFilter,
    query,
  ])
  // Nuevos/seguimiento EN SALA HOY (dueño, 06-nov-2026): solo pacientes PRESENTES — contar la lista
  // completa (agendados que ni han llegado) no dice nada útil sobre lo que está pasando ahora mismo.
  // `presentAt` ya es el de la CONSULTA (asConsultationView lo pisa con consultationPresentAt), no el
  // de un servicio. Data-driven del catálogo de subtipos del tablero (consultSubtypes), nunca
  // "nueva"/"seguimiento" a mano, para que cubra cualquier subtipo que el centro configure.
  // Same numbers in every tab (the toolbar does not change when switching): the whole day's
  // consultations, not the tab's filtered list.
  const consultSubtypeCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of consultSubtypes) counts.set(s.slug, 0)
    for (const p of filterByKind(day.patients, "consultation").map(asConsultationView)) {
      if (!p.presentAt) continue
      for (const slug of p.consultationSubtypes) {
        if (counts.has(slug)) counts.set(slug, (counts.get(slug) ?? 0) + 1)
      }
    }
    return counts
  }, [day.patients, consultSubtypes])
  // List view: keep a selection that still exists, else the first patient.
  const effectiveSelected = patients.some((p) => p.patientId === selectedId)
    ? selectedId
    : (patients[0]?.patientId ?? null)
  // Only the open patient's service boards are fetched (and refetched on every refresh).
  const boardsBySlug = useServiceBoards(
    gate.centro,
    date,
    (day.patients.find((p) => p.patientId === effectiveSelected)?.services ?? []).map((s) => s.slug),
    day.refreshTick
  )
  const data = React.useMemo(() => ({ ...day, boardsBySlug }), [day, boardsBySlug])

  // First load (or a new date/center): skeleton instead of a "0 patients" count and an empty list.
  const loadingDay =
    gate.cargando ||
    (!!gate.centro && data.loading && data.patients.length === 0)

  // Mantiene la URL al día con TODO lo que define esta vista (fecha, búsqueda, kind, sub-filtro y el
  // paciente que se ve ahora, aunque nunca se haya clicado — effectiveSelected, no el crudo
  // selectedId). `replace` (no `push`): cada tecleo no debe llenar el historial, solo la entrada
  // actual queda al día para cuando "Volver" de la ficha haga router.back().
  React.useEffect(() => {
    const sp = new URLSearchParams()
    sp.set("date", date)
    if (query) sp.set("q", query)
    if (kindPicked) sp.set("kind", kindPicked)
    if (serviceFilter) sp.set("service", serviceFilter)
    if (consultSubtypeFilter) sp.set("subtype", consultSubtypeFilter)
    if (effectiveSelected) sp.set("p", effectiveSelected)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }, [
    date,
    query,
    kindPicked,
    serviceFilter,
    consultSubtypeFilter,
    effectiveSelected,
    router,
  ])

  const serviceName = (slug: string) =>
    [...data.servicesById.values()].find((s) => s.slug === slug)?.name

  return (
    <PageContainer>
      {/* Title only: on this sidebar destination the shell shows it, so PageHeader renders nothing.
          The live badge sits in the toolbar instead of costing the page a row of its own. */}
      <PageHeader title={t("title")} />
      {!gate.cargando && !gate.sinCentro && !gate.necesitaPicker && (
        <EnTerapiaSinAsistirBanner centro={gate.centro} />
      )}

      {/* ONE row, the same in every tab (owner, 17-nov-2026): what the list shows on the left (tab,
          sub-filter, date, search), who is free right now and «Citar» on the right. Facts about the
          list («En sala») and «En vivo» (a dot) head the list itself. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-md border p-0.5"
          role="group"
          aria-label={t("kindLabel")}
        >
          {(["all", "services", "consultation"] as const).map((k) => {
            const active = kind === k
            // The active Servicios/Consulta tab carries its own sub-filter: clicking it opens the menu
            // (owner, 17-nov-2026: no separate ▾ button floating next to the tabs).
            const hasMenu = active && k !== "all"
            // «Consulta» has its own color when the BE catalogue sets one (consultationTab.color, same
            // field every service board carries); «Servicios» groups many boards, each with its OWN
            // color, so there is no single color to give that tab — it stays on the generic primary.
            // No color from the BE yet (owner, 23-nov-2026: no API to set one today) → the `warning`
            // theme token, the only other solid tone in the kit, so Consulta still reads as its own tab
            // instead of the same primary fill as Todos/Servicios.
            const consultColor = k === "consultation" ? data.consultationTab?.color : null
            const tab = (
              <button
                key={k}
                type="button"
                onClick={hasMenu ? undefined : () => pickKind(k)}
                aria-pressed={active}
                style={
                  active && consultColor
                    ? { backgroundColor: tinteFila(consultColor), color: consultColor }
                    : undefined
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium",
                  active
                    ? consultColor
                      ? "font-semibold"
                      : k === "consultation"
                        ? "bg-warning text-warning-foreground font-semibold"
                        : "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t(`kind.${k}`)}
                {hasMenu && <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />}
              </button>
            )
            return hasMenu ? (
              <ServiceFilterDropdown
                key={k}
                kind={kind}
                serviceFilter={serviceFilter}
                consultSubtypeFilter={consultSubtypeFilter}
                servicesToday={servicesToday}
                consultSubtypes={consultSubtypes}
                onPickService={pickServiceFilter}
                onPickConsultSubtype={setConsultSubtypeFilter}
                onOpenSummary={setSummaryOf}
                trigger={tab}
              />
            ) : (
              tab
            )
          })}
        </div>
        {/* El filtro activo se ve, no solo se infiere del ícono relleno — antes alguien dejaba
            "Seguimiento" puesto y no se daba cuenta de que algunos pacientes no aparecían (handoff
            quejas-de-mostrador-2026-10-20 §3). */}
        {kind === "services" && serviceFilter && (
          <button
            type="button"
            onClick={() => pickServiceFilter(null)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              serviceArrivedPending ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}
          >
            {t(serviceArrivedPending ? "filteringByPending" : "filteringBy", {
              name: servicesToday.find((s) => s.serviceId === serviceFilter)?.name ?? serviceFilter,
            })}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        )}
        {kind === "consultation" && consultSubtypeFilter && (
          <button
            type="button"
            onClick={() => setConsultSubtypeFilter(null)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {t("filteringBy", {
              name: (() => {
                const s = consultSubtypes.find((x) => x.slug === consultSubtypeFilter)
                return s ? consultSubtypeLabel(s, t, tRoot) : consultSubtypeFilter
              })(),
            })}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        )}
        <DatePicker
          className="w-40"
          value={date}
          onChange={setDate}
          aria-label={t("date")}
        />
        <div className="relative min-w-48 flex-1 sm:max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pr-8 pl-9"
            aria-label={t("searchPlaceholder")}
          />
          {/* Antes no había forma de limpiar sin borrar a mano — un récord buscado dejaba el panel
              "congelado" en ese paciente sin que se notara por qué (handoff
              quejas-de-mostrador-2026-10-20 §5). El SSE de usePatientDay no depende de `query` (filtra
              client-side sobre data.patients ya cargada), así que sigue vivo con la búsqueda puesta. */}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clearSearch")}
              title={t("clearSearch")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LiveLocationWidget
            centroId={gate.centro}
            nombreServicio={serviceName}
            iconOnly
          />
          <MedicosLibresWidget rows={data.consultations?.rows ?? []} date={date} centroId={gate.centro} centroNombre={gate.centroNombre} iconOnly />
          <NurseStatusButton
            centro={gate.centro}
            fecha={date}
            onChanged={data.refresh}
          />
          <TechnicianStatusButton centro={gate.centro} fecha={date} />
          {/* «Citar» is the same menu in every tab, so the toolbar does not change; in Servicios a
              filtered service is preselected. The service appointments list lives here too. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                {t("book")}
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can("citas.create") && (
                <>
                  <DropdownMenuItem
                    onSelect={() =>
                      setSchedule({
                        open: true,
                        pacienteId: "",
                        servicioId: kind === "services" ? (serviceFilter ?? undefined) : undefined,
                      })
                    }
                  >
                    {t("bookService")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAddingConsultation({ open: true })}>
                    {t("bookConsultation")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/scheduling/appointments">{t("serviceAppointments")}</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* No margins here: PageContainer's gap spaces the rows, and a strip that renders nothing
          (no queue today) adds no gap, so no empty band is left behind. */}
      <TherapyQueueStrip centerId={gate.centro} date={date} onSelectPatient={selectFromQueue} />
      {summaryOf && gate.centro && (
        <DaySummaryDialog
          open
          onOpenChange={(v) => !v && setSummaryOf(null)}
          service={{ id: summaryOf.serviceId, name: summaryOf.name }}
          date={date}
          centerId={gate.centro}
          centerName={gate.centroNombre}
        />
      )}

      {gate.cargando ? (
        <PatientDeskSkeleton />
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("facturacion.general.sinCentro")}
        </p>
      ) : gate.necesitaPicker ? (
        <CenterPicker centros={gate.centros} onPick={gate.pick} />
      ) : data.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {data.error}
        </p>
      ) : loadingDay ? (
        <PatientDeskSkeleton />
      ) : patients.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-16 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {query ? t("noMatches") : t("empty")}
        </p>
      ) : (
        <PatientListView
          live={data.live}
          headerEnd={
            // Consultation patients in the room: meaningful in Todos and Consulta, not in Servicios.
            kind !== "services" && consultSubtypes.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-x-3">
                <span>{t("enSala")}:</span>
                {consultSubtypes.map((s) => (
                  <span key={s.slug} className="whitespace-nowrap">
                    {consultSubtypeLabel(s, t, tRoot)}{" "}
                    <span className="font-semibold text-foreground tabular-nums">{consultSubtypeCounts.get(s.slug) ?? 0}</span>
                  </span>
                ))}
                {/* La suma, para no obligar al usuario a sumarlas de cabeza (dueño, 06-nov-2026). */}
                <span className="whitespace-nowrap">
                  {t("enSalaTotal")}{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {[...consultSubtypeCounts.values()].reduce((sum, n) => sum + n, 0)}
                  </span>
                </span>
              </span>
            )
          }
          patients={patients}
          data={data}
          kind={kind}
          serviceFilter={kind === "services" ? serviceFilter : null}
          date={date}
          centerId={gate.centro}
          selectedId={effectiveSelected}
          onSelect={setSelectedId}
          onSchedule={(r) => setSchedule({ open: true, ...r })}
          onScheduleConsultation={(r) =>
            setAddingConsultation({ open: true, ...r })
          }
        />
      )}

      {schedule.open && (
        <TherapyBookingForm
          patient={
            schedule.pacienteId
              ? { id: schedule.pacienteId, name: schedule.pacienteNombre ?? "" }
              : undefined
          }
          center={gate.centro}
          defaultDate={date}
          defaultServiceId={schedule.servicioId}
          onClose={() => setSchedule({ open: false })}
          onBooked={() => {
            data.refresh()
            setSchedule({ open: false })
          }}
        />
      )}

      {addingConsultation.open && (
        <BoardAppointmentModal
          centroId={gate.centro}
          lockedPatient={
            addingConsultation.pacienteId
              ? {
                  id: addingConsultation.pacienteId,
                  nombre: addingConsultation.pacienteNombre ?? "",
                }
              : undefined
          }
          onClose={() => setAddingConsultation({ open: false })}
          onSaved={data.refresh}
          onFilterPatient={(p) => setQuery(p.nombre)}
        />
      )}
    </PageContainer>
  )
}
