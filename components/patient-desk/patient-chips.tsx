"use client"

import { useTranslations } from "next-intl"

import { patientSections, serviceConcluded, type PatientDay } from "@/lib/frontdesk/patient-day"
import type { PatientDayData } from "@/hooks/use-patient-day"

// The chips that summarise a patient's day: one per service (its color + the status of its sessions)
// and one for the consultation. Shared by the list and the table views. Split out of patient-detail.tsx
// to keep that file under the 600-line ceiling (eslint.config.mjs) once the NO_PACKAGE_TO_ATTEND gate
// landed next to it.
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
  // Label and colour of a status come from the board's own catalogue (board_statuses: slug → labelKey,
  // color, both set per board by an admin), so they stay keyed by the catalogue slug until piece 6
  // replaces the catalogue. Decisions about the day read stage groups (lib/frontdesk/patient-day.ts).
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
  // A concluded service (every session attended) keeps its color and gets a green check.
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
        (concluded ? "border-success/50 bg-success/10" : "bg-background")
      }
    >
      <span
        className="size-2 rounded-full"
        style={{
          backgroundColor: color || "var(--muted-foreground)",
        }}
        aria-hidden
      />
      <span className="uppercase">{name}</span>
      {concluded && (
        <span className="text-success-foreground" aria-label={t("serviceDone")}>
          ✓
        </span>
      )}
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
      {patientSections(patient).map((x) =>
        x.kind === "service"
          ? chip(
              x.service.serviceId,
              x.service.color,
              x.service.name,
              x.service.statuses[0] ?? "",
              false,
              serviceConcluded(x.service)
            )
          : chip(
              "consult",
              data.consultationTab?.color ?? null,
              consultLabel,
              patient.consultationStatuses[0] ?? "",
              true
            )
      )}
    </div>
  )
}
