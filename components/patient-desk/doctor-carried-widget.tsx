"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Doctor03Icon } from "@hugeicons/core-free-icons"

import { getDoctorSummary, type DoctorSummaryByDoctor } from "@/lib/api/doctor-summary"
import { sortedByDoctor, totalCarried } from "@/lib/frontdesk/doctor-summary"
import { useResource } from "@/hooks/use-resource"
import { StatusCountButton } from "@/components/frontdesk/status-count-button"
import { DoctorSummaryDialog } from "@/components/patient-desk/doctor-summary-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// How many patients each doctor is carrying right now on Consultas (owner 18-nov-2026, via reception:
// «dónde ver cuántos pacientes lleva cada médico para repartir la carga»). Next to "Médicos libres",
// same shell. Clicking a doctor opens their detail (DoctorSummaryDialog, the shared report shell).
// Handoff docs/specs/resumen-por-medico-handoff-be.md (cmr-be #637).
export function DoctorCarriedWidget({
  date,
  centerId,
  centerName,
  iconOnly = false,
}: {
  date: string
  centerId?: string
  centerName: string
  iconOnly?: boolean
}) {
  const t = useTranslations("patientDesk.doctorSummary")
  const res = useResource(() => (centerId ? getDoctorSummary({ date, centerId }) : Promise.resolve(null)), [date, centerId])
  const [detailDoctor, setDetailDoctor] = React.useState<{ id?: string; name?: string } | null>(null)
  const byDoctor = res.state.kind === "ok" && res.state.data ? sortedByDoctor(res.state.data.totals.byDoctor) : []
  const carried = res.state.kind === "ok" && res.state.data ? totalCarried(res.state.data.totals.byDoctor) : 0

  // The owner asked for "nuevas/seguimientos" specifically, but the types themselves are DATA
  // (handoff: "pintar type.name, no textos fijos") — rendering every entry of `byType` gives that
  // split in whatever categories the BE actually has today, without hardcoding a slug that could
  // silently stop matching if the catalog changes.
  const row = (d: DoctorSummaryByDoctor) => {
    const types = d.byType.map((ty) => `${ty.name}: ${ty.count}`).join(" · ")
    return (
      <button
        key={d.doctorId ?? "—"}
        type="button"
        onClick={() => centerId && setDetailDoctor({ id: d.doctorId ?? undefined, name: d.doctor ?? undefined })}
        className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
      >
        <span className="flex items-center justify-between font-medium">
          <span>{d.doctor ?? t("noDoctor")}</span>
          <Badge variant="secondary" className="tabular-nums">
            {t("carriedN", { n: d.carried })}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {types && `${types} · `}
          {t("attendedAndWaiting", { attended: d.attended, waiting: d.waiting })}
        </span>
      </button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {iconOnly ? (
            <StatusCountButton icon={Doctor03Icon} count={carried} label={t("title")} />
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5">
              <HugeiconsIcon icon={Doctor03Icon} className="size-4" />
              {t("title")}
              {carried > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {carried}
                </Badge>
              )}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {byDoctor.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            byDoctor.map(row)
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {centerId && (
        <DoctorSummaryDialog
          open={!!detailDoctor}
          onOpenChange={(v) => !v && setDetailDoctor(null)}
          date={date}
          centerId={centerId}
          centerName={centerName}
          doctorId={detailDoctor?.id}
          doctorName={detailDoctor?.name}
        />
      )}
    </>
  )
}
