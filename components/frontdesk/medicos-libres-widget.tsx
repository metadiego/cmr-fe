"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Doctor03Icon } from "@hugeicons/core-free-icons"

import type { CitaFila } from "@/lib/api/agenda-dia"
import { freeDoctors } from "@/lib/frontdesk/doctors-free"
import { listActiveDoctorAbsences } from "@/lib/api/disponibilidad"
import { useResource } from "@/hooks/use-resource"
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
export function MedicosLibresWidget({
  rows,
  date,
  centroId,
  iconOnly = false,
}: {
  rows: CitaFila[]
  date: string
  centroId?: string
  iconOnly?: boolean
}) {
  const t = useTranslations("frontdesk.medicosLibres")
  const ausenciasRes = useResource(
    () => (centroId ? listActiveDoctorAbsences(date, centroId) : Promise.resolve([])),
    [date, centroId],
  )
  const ausentes = React.useMemo(() => {
    const data = ausenciasRes.state.kind === "ok" ? ausenciasRes.state.data : []
    return new Set(data.filter((a) => a.active !== false).map((a) => a.doctorId))
  }, [ausenciasRes.state])
  const libres = React.useMemo(() => freeDoctors(rows, ausentes), [rows, ausentes])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          title={iconOnly ? t("titulo") : undefined}
          aria-label={iconOnly ? t("titulo") : undefined}
        >
          <HugeiconsIcon icon={Doctor03Icon} className="size-4" />
          {!iconOnly && t("titulo")}
          {libres.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {libres.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
