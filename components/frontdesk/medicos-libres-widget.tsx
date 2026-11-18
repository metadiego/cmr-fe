"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Doctor03Icon } from "@hugeicons/core-free-icons"

import type { CitaFila } from "@/lib/api/agenda-dia"
import { freeDoctors } from "@/lib/frontdesk/doctors-free"
import { listActiveDoctorAbsences } from "@/lib/api/disponibilidad"
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

// Quién puede recibir un paciente AHORA MISMO: médicos con fila hoy en el tablero de Atención,
// ninguna de ellas `en_consulta`, Y sin una ausencia activa (vacaciones/permiso) hoy (owner,
// 06-nov-2026 — caso real: Gilberto Caraballo de vacaciones no debe salir "libre" solo porque nadie
// le agendó nada). Un médico sin fila hoy tampoco sale: no agendado no es lo mismo que libre.
//
// La misma ventana también dice cuánto lleva cada médico OCUPADO (owner, 18-nov-2026, vía recepción:
// "dónde ver cuántos pacientes lleva cada médico para repartir la carga"): un solo botón, sin agregar
// un ícono más a la barra ("minimalista" — el dueño pidió explícitamente que no creciera la barra).
// El detalle de un médico abre DoctorSummaryDialog, el mismo cascarón de reporte compartido.
export function MedicosLibresWidget({
  rows,
  date,
  centroId,
  centroNombre,
  iconOnly = false,
}: {
  rows: CitaFila[]
  date: string
  centroId?: string
  centroNombre?: string
  iconOnly?: boolean
}) {
  const t = useTranslations("frontdesk.medicosLibres")
  const tDoctor = useTranslations("patientDesk.doctorSummary")
  const ausenciasRes = useResource(
    () => (centroId ? listActiveDoctorAbsences(date, centroId) : Promise.resolve([])),
    [date, centroId],
  )
  const ausentes = React.useMemo(() => {
    const data = ausenciasRes.state.kind === "ok" ? ausenciasRes.state.data : []
    return new Set(data.filter((a) => a.active !== false).map((a) => a.doctorId))
  }, [ausenciasRes.state])
  const libres = React.useMemo(() => freeDoctors(rows, ausentes), [rows, ausentes])

  const summaryRes = useResource(
    () => (centroId ? getDoctorSummary({ date, centerId: centroId }) : Promise.resolve(null)),
    [date, centroId],
  )
  const [detailDoctor, setDetailDoctor] = React.useState<{ id?: string; name?: string } | null>(null)
  const ocupados = React.useMemo(() => {
    const byDoctor = summaryRes.state.kind === "ok" && summaryRes.state.data ? summaryRes.state.data.totals.byDoctor : []
    return sortedByDoctor(byDoctor).filter((d) => d.carried > 0)
  }, [summaryRes.state])
  const carried = summaryRes.state.kind === "ok" && summaryRes.state.data ? totalCarried(summaryRes.state.data.totals.byDoctor) : 0

  const ocupadoRow = (d: DoctorSummaryByDoctor) => {
    const types = d.byType.map((ty) => `${ty.name}: ${ty.count}`).join(" · ")
    return (
      <button
        key={d.doctorId ?? "—"}
        type="button"
        onClick={() => centroId && setDetailDoctor({ id: d.doctorId ?? undefined, name: d.doctor ?? undefined })}
        className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
      >
        <span className="flex items-center justify-between font-medium">
          <span>{d.doctor ?? tDoctor("noDoctor")}</span>
          <Badge variant="secondary" className="tabular-nums">
            {tDoctor("carriedN", { n: d.carried })}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {types && `${types} · `}
          {tDoctor("attendedAndWaiting", { attended: d.attended, waiting: d.waiting })}
        </span>
      </button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {iconOnly ? (
            <StatusCountButton icon={Doctor03Icon} count={libres.length} label={t("titulo")} />
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5">
              <HugeiconsIcon icon={Doctor03Icon} className="size-4" />
              {t("titulo")}
              {libres.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {libres.length}
                </Badge>
              )}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>{t("titulo")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {libres.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{t("vacio")}</p>
          ) : (
            libres.map((d) => (
              <div key={d.id} className="px-2 py-1.5 text-sm font-medium">
                {d.name}
              </div>
            ))
          )}
          {ocupados.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{tDoctor("title")}{carried > 0 && ` · ${carried}`}</DropdownMenuLabel>
              {ocupados.map(ocupadoRow)}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {centroId && (
        <DoctorSummaryDialog
          open={!!detailDoctor}
          onOpenChange={(v) => !v && setDetailDoctor(null)}
          date={date}
          centerId={centroId}
          centerName={centroNombre ?? ""}
          doctorId={detailDoctor?.id}
          doctorName={detailDoctor?.name}
        />
      )}
    </>
  )
}
