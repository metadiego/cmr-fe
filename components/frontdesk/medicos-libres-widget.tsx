"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Doctor03Icon } from "@hugeicons/core-free-icons"

import type { CitaFila } from "@/lib/api/agenda-dia"
import { freeDoctors } from "@/lib/frontdesk/doctors-free"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Quién puede recibir un paciente AHORA MISMO: médicos con fila hoy en el tablero de Atención y
// ninguna de ellas `en_consulta` (owner, 06-nov-2026 — pide esto junto al widget de ubicación en vivo,
// mismos datos que ya trae la pestaña Consulta, sin pedir nada nuevo al BE). Un médico sin fila hoy no
// sale: no agendado no es lo mismo que libre.
export function MedicosLibresWidget({
  rows,
  iconOnly = false,
}: {
  rows: CitaFila[]
  iconOnly?: boolean
}) {
  const t = useTranslations("frontdesk.medicosLibres")
  const libres = React.useMemo(() => freeDoctors(rows), [rows])

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
