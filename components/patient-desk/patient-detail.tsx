"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Tick02Icon, UserIcon } from "@hugeicons/core-free-icons"

import {
  serviceConcluded,
  type PatientDay,
  type PatientKind,
} from "@/lib/frontdesk/patient-day"
import type { PatientDayData } from "@/hooks/use-patient-day"
import { presentPatient, undoPresentPatient } from "@/lib/api/frontdesk-queue"
import { fmtHora } from "@/components/frontdesk/frontdesk-board.helpers"
import { toastError } from "@/lib/api/errors"
import { ServiceSessionsTable } from "@/components/patient-desk/service-sessions-table"
import { ConsultationRows } from "@/components/patient-desk/consultation-rows"
import { Button } from "@/components/ui/button"
import { PriorityFlagsBadges } from "@/components/clientes/priority-flags-badges"

export type ScheduleRequest = {
  pacienteId: string
  pacienteNombre?: string
  servicioId?: string
}

// The chips that summarise a patient's day: one per service (its color + the status of its sessions)
// and one for the consultation. Shared by the list and the table views.
export function PatientChips({
  patient,
  data,
  compact,
}: {
  patient: PatientDay
  data: PatientDayData
  compact?: boolean
}) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  const statusLabel = (slug: string, consult = false) => {
    const def = consult ? data.consultationDefinition : data.serviceDefinition
    const s = def?.statuses.find((x) => x.slug === slug)
    return s ? tRoot(s.labelKey) : slug
  }
  const statusColor = (slug: string, consult = false) =>
    (consult
      ? data.consultationDefinition
      : data.serviceDefinition
    )?.statuses.find((x) => x.slug === slug)?.color ?? null
  const consultLabel = data.consultationTab
    ? tRoot.has(data.consultationTab.labelKey)
      ? tRoot(data.consultationTab.labelKey)
      : data.consultationTab.name
    : t("consultation")
  // A concluded service (every session attended) is painted gray.
  const chip = (
    key: string,
    color: string | null,
    name: string,
    status: string,
    consult = false,
    concluded = false
  ) => (
    <span
      key={key}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium " +
        (concluded ? "bg-muted text-muted-foreground" : "bg-background")
      }
    >
      <span
        className="size-2 rounded-full"
        style={{
          backgroundColor:
            concluded || !color ? "var(--muted-foreground)" : color,
        }}
        aria-hidden
      />
      <span className="uppercase">{name}</span>
      {!compact && status && (
        <span
          className="rounded-full px-1.5 text-[10px]"
          style={{
            backgroundColor: `${statusColor(status, consult) ?? "#94a3b8"}22`,
            color: statusColor(status, consult) ?? undefined,
          }}
        >
          {statusLabel(status, consult)}
        </span>
      )}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-1.5">
      {patient.services.map((s) =>
        chip(
          s.serviceId,
          s.color,
          s.name,
          s.statuses[0] ?? "",
          false,
          serviceConcluded(s)
        )
      )}
      {patient.consultationIds.length > 0 &&
        chip(
          "consult",
          data.consultationTab?.color ?? null,
          consultLabel,
          patient.consultationStatuses[0] ?? "",
          true
        )}
    </div>
  )
}

// Everything a patient has today: each service with its own columns and the consultation, editable in
// place with the same cells and flow as the frontdesk board.
export function PatientDetail({
  patient,
  data,
  kind = "all",
  date,
  centerId,
  onSchedule,
  onFlagsChange,
}: {
  patient: PatientDay
  data: PatientDayData
  kind?: PatientKind
  date: string
  centerId: string | undefined
  onSchedule: (r: ScheduleRequest) => void
  onFlagsChange?: () => void
}) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  const consultLabel = data.consultationTab
    ? tRoot.has(data.consultationTab.labelKey)
      ? tRoot(data.consultationTab.labelKey)
      : data.consultationTab.name
    : t("consultation")
  const [presenceBusy, setPresenceBusy] = React.useState(false)

  // UNA llegada por paciente al día, no por terapia (BE PR #424, 10-oct-2026): reemplaza el "Presente"
  // que antes vivía en cada fila de servicio (ver pasosOcultos en ServiceSessionsTable). `failed` trae
  // terapias que no pudieron marcarse por su propia regla — las demás quedan marcadas igual, por eso
  // es un aviso, no un error que bloquee.
  async function handlePresent() {
    setPresenceBusy(true)
    try {
      const res = await presentPatient(patient.patientId, date, centerId)
      if (res.failed.length > 0) {
        toast.warning(res.failed.map((f) => f.reason).join(" · "))
      }
      data.refresh()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setPresenceBusy(false)
    }
  }

  async function handleUndoPresent() {
    setPresenceBusy(true)
    try {
      await undoPresentPatient(patient.patientId, centerId)
      data.refresh()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setPresenceBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The priority flags (oxygen, wheelchair…) show in the list, next to the record; here is only
              the menu that sets them. */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">
              {patient.name || "—"}
            </h2>
            <PriorityFlagsBadges
              patientId={patient.patientId}
              centroId={centerId}
              showBadges={false}
              onChange={onFlagsChange}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {patient.record ? `${t("record")} #${patient.record}` : ""}
            {patient.earliestTime
              ? ` · ${t("firstAt", { time: patient.earliestTime })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {patient.services.length > 0 &&
            (patient.presentAt ? (
              <div className="flex items-center gap-1 rounded-md border bg-muted/40 py-1 pr-1 pl-2.5 text-sm">
                <span className="text-muted-foreground">
                  {t("arrivedAt", { time: fmtHora(patient.presentAt) })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={presenceBusy}
                  onClick={handleUndoPresent}
                >
                  {t("undoPresent")}
                </Button>
              </div>
            ) : (
              <Button size="sm" disabled={presenceBusy} onClick={handlePresent}>
                <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                {t("markPresent")}
              </Button>
            ))}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.patientId}`}>
              <HugeiconsIcon icon={UserIcon} className="size-4" />
              {t("openRecord")}
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onSchedule({
                pacienteId: patient.patientId,
                pacienteNombre: patient.name,
              })
            }
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
            {t("book")}
          </Button>
        </div>
      </div>

      {kind !== "consultation" &&
        patient.services.map((s) => (
          <ServiceSessionsTable
            key={s.serviceId}
            slug={s.slug}
            name={s.name}
            color={s.color}
            concluded={serviceConcluded(s)}
            service={data.servicesById.get(s.serviceId)}
            board={data.boardsBySlug[s.slug]}
            definition={data.serviceDefinition}
            sessionsById={data.sessionsById}
            sessionIds={s.sessionIds}
            patientId={patient.patientId}
            date={date}
            centerId={centerId}
            onChanged={data.refresh}
            onSchedule={(ctx) =>
              onSchedule({ ...ctx, servicioId: ctx.servicioId ?? s.serviceId })
            }
          />
        ))}

      {kind !== "services" &&
        patient.consultationIds.length > 0 &&
        data.consultations && (
          <ConsultationRows
            board={data.consultations}
            definition={data.consultationDefinition}
            rowIds={patient.consultationIds}
            color={data.consultationTab?.color ?? null}
            label={consultLabel}
            centerId={centerId}
            onChanged={data.refresh}
          />
        )}
    </div>
  )
}
