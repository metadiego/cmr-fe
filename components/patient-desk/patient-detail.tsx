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
import { ejecutarAccion } from "@/lib/api/tablero"
import { fmtHora } from "@/components/frontdesk/frontdesk-board.helpers"
import { apiErrorLabel, toastError } from "@/lib/api/errors"
import { ApiError } from "@/lib/api/types"
import { ServiceSessionsTable } from "@/components/patient-desk/service-sessions-table"
import { ConsultationRows } from "@/components/patient-desk/consultation-rows"
import { Button } from "@/components/ui/button"
import { PriorityFlagsBadges } from "@/components/clientes/priority-flags-badges"

export type ScheduleRequest = {
  pacienteId: string
  pacienteNombre?: string
  servicioId?: string
}

// Estados de la consulta donde "presente" todavía aplica (board atencion: programada/confirmada ->
// presente). Ni "presente" en sí (ya está) ni nada más adelante (triage/en_consulta/atendida) ni
// terminal (cancelada/no_show/reprogramada) — evita reabrir algo que ya avanzó.
const CONSULT_PENDING_STATUSES = new Set(["programada", "confirmada"])

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
  //
  // El MISMO botón también marca presente la consulta, si tiene una pendiente (programada/confirmada):
  // el dueño no quiere marcar presente dos veces al mismo paciente por tener servicio Y consulta el
  // mismo día (caso real, record 15612, 13-oct-2026). La consulta usa su propio board (`atencion`),
  // así que es la MISMA acción `ejecutarAccion` que ya dispara cada pill de su flujo — nada nuevo del
  // lado del BE, solo disparada desde aquí también.
  async function handlePresent() {
    setPresenceBusy(true)
    try {
      const res = await presentPatient(patient.patientId, date, centerId)
      const warnings = res.failed.map((f) => f.reason)
      const pendingConsultIds = patient.consultationIds.filter((_, i) =>
        CONSULT_PENDING_STATUSES.has(patient.consultationStatuses[i])
      )
      if (pendingConsultIds.length > 0) {
        const results = await Promise.allSettled(
          pendingConsultIds.map((id) =>
            ejecutarAccion({ boardSlug: "atencion", entityId: id, action: "presente" }, centerId)
          )
        )
        // El motivo real (p. ej. "faltan datos obligatorios del paciente...", PACIENTE_DATOS_REQUERIDOS
        // de un paciente nuevo, con sus campos exactos) importa más que un genérico — es justo lo que
        // el personal necesita para resolverlo en Atención, sin adivinar por qué no se pudo. El modal
        // que PIDE esos datos en el momento vive en flujo-atencion.tsx (su propia fila); aquí solo se
        // avisa — abrir ese mismo modal desde el header queda para si hace falta más adelante.
        for (const r of results) {
          if (r.status !== "rejected") continue
          const err = r.reason
          const faltantes =
            err instanceof ApiError && err.code === "PACIENTE_DATOS_REQUERIDOS"
              ? (err.data?.faltantes as string[] | undefined)
              : undefined
          warnings.push(
            faltantes?.length
              ? `${apiErrorLabel(err, tRoot)}: ${faltantes.join(", ")}`
              : apiErrorLabel(err, tRoot)
          )
        }
      }
      if (warnings.length > 0) toast.warning(warnings.join(" · "))
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
      // Simétrico: solo la consulta que el present de arriba pudo haber marcado (sigue en "presente"
      // exacto) — nunca una que ya avanzó a triage/en_consulta/atendida por su cuenta.
      const presentConsultIds = patient.consultationIds.filter(
        (_, i) => patient.consultationStatuses[i] === "presente"
      )
      if (presentConsultIds.length > 0) {
        await Promise.allSettled(
          presentConsultIds.map((id) =>
            ejecutarAccion(
              { boardSlug: "atencion", entityId: id, action: "volver_confirmada" },
              centerId
            )
          )
        )
      }
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
            {/* El nombre ABRE la ficha igual que el botón "Ficha": al volver (flecha de la ficha,
                router.back()), Next restaura este mismo patient-desk tal cual estaba — fecha, filtro,
                búsqueda y paciente elegido — porque la navegación es del lado del cliente (Link), no
                recarga la página (13-oct-2026). */}
            <h2 className="truncate text-lg font-semibold">
              <Link
                href={`/patients/${patient.patientId}`}
                className="hover:underline"
              >
                {patient.name || "—"}
              </Link>
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
          {/* Un único botón para servicios Y consulta, indistinto de cuál tenga el paciente (13-oct-2026):
              antes solo aparecía con servicios, dejando a quien SOLO tiene consulta sin forma de llegar
              aquí salvo por su propia fila — justo la fila que acabamos de ocultar. */}
          {(patient.services.length > 0 || patient.consultationIds.length > 0) &&
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
