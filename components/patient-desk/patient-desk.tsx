"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Search01Icon } from "@hugeicons/core-free-icons"

import {
  filterByKind,
  filterPatients,
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

  const [date, setDate] = React.useState(todayISO())
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [schedule, setSchedule] = React.useState<
    (ScheduleRequest & { open: boolean }) | { open: false }
  >({ open: false })

  const data = usePatientDay(gate.centro, date)
  // Services / consultation / all. Starts on consultation for whoever has «lands on Consulta» in their
  // staff record (the reception people, set per person in the staff screen — not a role list here).
  const preference = useMyFrontdeskPreference(gate.centro)
  const [kindPicked, setKindPicked] = React.useState<PatientKind | null>(null)
  const kind: PatientKind =
    kindPicked ??
    (preference.state.kind === "ok" &&
    preference.state.data?.frontdeskStartsOnConsultation
      ? "consultation"
      : "all")
  const patients = React.useMemo(
    () => filterPatients(filterByKind(data.patients, kind), query),
    [data.patients, kind, query]
  )
  // List view: keep a selection that still exists, else the first patient.
  const effectiveSelected = patients.some((p) => p.patientId === selectedId)
    ? selectedId
    : (patients[0]?.patientId ?? null)

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
              onClick={() => setKindPicked(k)}
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
        <span className="text-xs text-muted-foreground">
          {t("patientsCount", { n: patients.length })}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LiveLocationWidget
            centroId={gate.centro}
            nombreServicio={serviceName}
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
          {can("citas.create") && (
            <Button
              size="sm"
              onClick={() => setSchedule({ open: true, pacienteId: "" })}
            >
              <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
              {t("book")}
            </Button>
          )}
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
    </PageContainer>
  )
}
