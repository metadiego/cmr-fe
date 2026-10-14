"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Calendar03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import {
  filterByConsultationSubtype,
  filterByKind,
  filterByService,
  filterPatients,
  servicesOfTheDay,
  type PatientKind,
} from "@/lib/frontdesk/patient-day"
import { useMyFrontdeskPreference } from "@/hooks/use-frontdesk-default-tab"
import { cn } from "@/lib/utils"
import { usePatientDay } from "@/hooks/use-patient-day"
import { useCentroGate as useCenterGate } from "@/hooks/use-centro-gate"
import { useCan } from "@/hooks/use-can"
import { todayISO } from "@/components/frontdesk/frontdesk-board.helpers"
import { UbicacionEnVivoWidget as LiveLocationWidget } from "@/components/frontdesk/ubicacion-en-vivo-widget"
import { NurseStatusButton } from "@/components/frontdesk/nurse-status-button"
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler"
import { AgregarCitaModal as AddConsultationModal } from "@/components/tablero/agregar-cita-modal"
import { CentroPicker as CenterPicker } from "@/components/facturacion/centro-picker"
import { PatientListView } from "@/components/patient-desk/patient-list-view"
import { TherapyQueueStrip } from "@/components/patient-desk/therapy-queue-strip"
import type { ScheduleRequest } from "@/components/patient-desk/patient-detail"
import { LiveBadge } from "@/components/live-badge"
import { PageContainer, PageHeader } from "@/components/ui/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const SUB_FILTER_ALL = "__all__"

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

  const [date, setDate] = React.useState(
    () => initialParams.get("date") ?? todayISO()
  )
  const [query, setQuery] = React.useState(() => initialParams.get("q") ?? "")
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    initialParams.get("p")
  )
  const [schedule, setSchedule] = React.useState<
    (ScheduleRequest & { open: boolean }) | { open: false }
  >({ open: false })
  const [addingConsultation, setAddingConsultation] = React.useState<
    { open: true; pacienteId?: string; pacienteNombre?: string } | { open: false }
  >({ open: false })

  const data = usePatientDay(gate.centro, date)
  // Services / consultation / all. Starts on consultation for whoever has «lands on Consulta» in their
  // staff record (the reception people, set per person in the staff screen — not a role list here).
  const preference = useMyFrontdeskPreference(gate.centro)
  const [kindPicked, setKindPicked] = React.useState<PatientKind | null>(() => {
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
  const [serviceFilter, setServiceFilter] = React.useState<string | null>(
    () => initialParams.get("service")
  )
  const [consultSubtypeFilter, setConsultSubtypeFilter] = React.useState<
    string | null
  >(() => initialParams.get("subtype"))
  const pickKind = (k: PatientKind) => {
    setKindPicked(k)
    setServiceFilter(null)
    setConsultSubtypeFilter(null)
  }
  const servicesToday = React.useMemo(
    () => servicesOfTheDay(data.patients),
    [data.patients]
  )
  const consultSubtypes = React.useMemo(
    () =>
      [...(data.consultationDefinition?.subtypes ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder
      ),
    [data.consultationDefinition]
  )
  const patients = React.useMemo(() => {
    let list = filterByKind(data.patients, kind)
    if (kind === "services") list = filterByService(list, serviceFilter)
    if (kind === "consultation")
      list = filterByConsultationSubtype(list, consultSubtypeFilter)
    return filterPatients(list, query)
  }, [data.patients, kind, serviceFilter, consultSubtypeFilter, query])
  // List view: keep a selection that still exists, else the first patient.
  const effectiveSelected = patients.some((p) => p.patientId === selectedId)
    ? selectedId
    : (patients[0]?.patientId ?? null)

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
      <PageHeader
        title={t("title")}
        count={data.live && <LiveBadge label={t("live")} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <DatePicker
          className="w-40"
          value={date}
          onChange={setDate}
          aria-label={t("date")}
        />
        <div
          className="inline-flex rounded-md border p-0.5"
          role="group"
          aria-label={t("kindLabel")}
        >
          {(["all", "services", "consultation"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pickKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium",
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
        {kind === "services" || kind === "consultation" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant={
                  (kind === "services" && serviceFilter) ||
                  (kind === "consultation" && consultSubtypeFilter)
                    ? "default"
                    : "outline"
                }
                size="icon"
                className="size-7"
                aria-label={
                  kind === "services" ? t("filterByService") : t("filterByType")
                }
              >
                <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {kind === "services" ? (
                <DropdownMenuRadioGroup
                  value={serviceFilter ?? SUB_FILTER_ALL}
                  onValueChange={(v) =>
                    setServiceFilter(v === SUB_FILTER_ALL ? null : v)
                  }
                >
                  <DropdownMenuRadioItem value={SUB_FILTER_ALL}>
                    {t("allServices")}
                  </DropdownMenuRadioItem>
                  {servicesToday.map((s) => (
                    <DropdownMenuRadioItem
                      key={s.serviceId}
                      value={s.serviceId}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              s.color ?? "var(--muted-foreground)",
                          }}
                          aria-hidden
                        />
                        {s.name}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              ) : (
                <DropdownMenuRadioGroup
                  value={consultSubtypeFilter ?? SUB_FILTER_ALL}
                  onValueChange={(v) =>
                    setConsultSubtypeFilter(v === SUB_FILTER_ALL ? null : v)
                  }
                >
                  <DropdownMenuRadioItem value={SUB_FILTER_ALL}>
                    {t("allTypes")}
                  </DropdownMenuRadioItem>
                  {consultSubtypes.map((s) => (
                    <DropdownMenuRadioItem key={s.id} value={s.slug}>
                      {tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.slug}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {t("patientsCount", { n: patients.length })}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LiveLocationWidget
            centroId={gate.centro}
            nombreServicio={serviceName}
            iconOnly
          />
          <NurseStatusButton
            centro={gate.centro}
            fecha={date}
            onChanged={data.refresh}
          />
          <Button variant="outline" size="sm" asChild>
            <Link href="/scheduling/appointments?tab=servicios">
              {t("serviceAppointments")}
            </Link>
          </Button>
          {/* «Citar» follows the toggle: Servicios books therapies (the filtered service preselected),
              Consulta adds a consultation to today's board, Todos asks which. */}
          {can("citas.create") &&
            (kind === "all" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                    {t("book")}
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      className="size-3.5"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => setSchedule({ open: true, pacienteId: "" })}
                  >
                    {t("bookService")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setAddingConsultation({ open: true })}
                  >
                    {t("bookConsultation")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  kind === "consultation"
                    ? setAddingConsultation({ open: true })
                    : setSchedule({
                        open: true,
                        pacienteId: "",
                        servicioId: serviceFilter ?? undefined,
                      })
                }
              >
                <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                {t(
                  kind === "consultation" ? "bookConsultation" : "bookService"
                )}
              </Button>
            ))}
        </div>
      </div>

      {kind !== "consultation" && (
        <div className="mb-4">
          <TherapyQueueStrip centerId={gate.centro} date={date} />
        </div>
      )}

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("common.loading")}
        </p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("facturacion.general.sinCentro")}
        </p>
      ) : gate.necesitaPicker ? (
        <div className="max-w-xl">
          <CenterPicker centros={gate.centros} onPick={gate.pick} />
        </div>
      ) : data.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {data.error}
        </p>
      ) : data.loading && data.patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("common.loading")}
        </p>
      ) : patients.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-16 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {query ? t("noMatches") : t("empty")}
        </p>
      ) : (
        <PatientListView
          patients={patients}
          data={data}
          kind={kind}
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

      <Dialog
        open={schedule.open}
        onOpenChange={(o) => !o && setSchedule({ open: false })}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{tRoot("programarCitas.title")}</DialogTitle>
          </DialogHeader>
          {schedule.open && (
            <TherapyDayScheduler
              defaultDate={date}
              defaultServiceId={schedule.servicioId}
              centro={gate.centro}
              lockedPatient={
                schedule.pacienteId
                  ? {
                      id: schedule.pacienteId,
                      name: schedule.pacienteNombre ?? "",
                    }
                  : undefined
              }
              onBooked={({ close }) => {
                data.refresh()
                if (close) setSchedule({ open: false })
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {addingConsultation.open && (
        <AddConsultationModal
          tablero="atencion"
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
