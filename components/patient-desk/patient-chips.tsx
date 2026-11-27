"use client"

import { useTranslations } from "next-intl"

import {
  patientSections,
  serviceConcluded,
  type PatientDay,
} from "@/lib/frontdesk/patient-day"
import { chipStatus } from "@/lib/frontdesk/patient-chip"
import type { StageGroup } from "@/lib/lifecycle/stage-groups"
import type { StageLabel } from "@/lib/lifecycle/stage-labels"
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
  // A chip's status: the row's stage label (not served reads as such) in the colour of the board status
  // of its stage group (lib/frontdesk/patient-chip.ts); the raw status only when no stage is known.
  type Status = {
    raw: string
    group: StageGroup | null
    label: StageLabel | null
  }
  const statusView = (st: Status, consult = false) => {
    const def = consult ? data.consultationDefinition : data.serviceDefinition
    const v = chipStatus(
      consult ? "medical" : "therapy",
      def?.statuses ?? [],
      st.group,
      st.label
    )
    return { text: v.labelKey ? tRoot(v.labelKey) : st.raw, color: v.color }
  }
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
    status: Status,
    consult = false,
    concluded = false
  ) => {
    const view = statusView(status, consult)
    return (
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
          <span
            className="text-success-foreground"
            aria-label={t("serviceDone")}
          >
            ✓
          </span>
        )}
        {!compact && view.text && (
          <span
            className="rounded-full px-1.5 text-[10px]"
            style={{
              backgroundColor: `${view.color ?? "#94a3b8"}22`,
              color: view.color ?? undefined,
            }}
          >
            {view.text}
          </span>
        )}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {patientSections(patient).map((x) =>
        x.kind === "service"
          ? chip(
              x.service.serviceId,
              x.service.color,
              x.service.name,
              {
                raw: x.service.statuses[0] ?? "",
                group: x.service.groups[0] ?? null,
                label: x.service.labels[0] ?? null,
              },
              false,
              serviceConcluded(x.service)
            )
          : chip(
              "consult",
              data.consultationTab?.color ?? null,
              consultLabel,
              {
                raw: patient.consultationStatuses[0] ?? "",
                group: patient.consultationGroups[0] ?? null,
                label: patient.consultationLabels[0] ?? null,
              },
              true
            )
      )}
    </div>
  )
}
