"use client"

import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { PatientKind } from "@/lib/frontdesk/patient-day"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const SUB_FILTER_ALL = "__all__"

export type ServiceOfTheDay = {
  serviceId: string
  name: string
  color: string | null
  arrived: number
  attended: number
}

export type ConsultSubtype = { id: string; slug: string; labelKey: string }

// Sub-filtro DENTRO de la pestaña activa: un servicio ("Servicios") o un subtipo ("Consulta").
// Extraído de patient-desk.tsx (que estaba en su techo de líneas) — pedido original del dueño de
// filtrar por servicio; el N=presente/N=asistidos clicable es del 06-nov-2026 (handoff
// patient-desk-presente-vs-asistido): cada fila trae, además del punto de color, cuántos llegaron
// hoy contra cuántos ya se cerraron — si no coinciden, el número es clicable y salta directo a
// quienes faltan por asistir en ESE servicio.
export function ServiceFilterDropdown({
  kind,
  serviceFilter,
  consultSubtypeFilter,
  servicesToday,
  consultSubtypes,
  onPickService,
  onPickConsultSubtype,
}: {
  kind: PatientKind
  serviceFilter: string | null
  consultSubtypeFilter: string | null
  servicesToday: ServiceOfTheDay[]
  consultSubtypes: ConsultSubtype[]
  onPickService: (serviceId: string | null, pendingOnly?: boolean) => void
  onPickConsultSubtype: (subtype: string | null) => void
}) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  if (kind !== "services" && kind !== "consultation") return null

  return (
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
          aria-label={kind === "services" ? t("filterByService") : t("filterByType")}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {kind === "services" ? (
          <DropdownMenuRadioGroup
            value={serviceFilter ?? SUB_FILTER_ALL}
            onValueChange={(v) => onPickService(v === SUB_FILTER_ALL ? null : v)}
          >
            <DropdownMenuRadioItem value={SUB_FILTER_ALL}>{t("allServices")}</DropdownMenuRadioItem>
            {servicesToday.map((s) => {
              const missing = s.arrived - s.attended
              return (
                <DropdownMenuRadioItem key={s.serviceId} value={s.serviceId}>
                  <span className="flex w-full items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {s.arrived > 0 && (
                      <span
                        role={missing > 0 ? "button" : undefined}
                        tabIndex={missing > 0 ? 0 : undefined}
                        // Radix selects the radio item on pointer-up (and closes the menu right
                        // then, unmounting it) — a plain onClick fires AFTER that, often with no
                        // live target left to dispatch to. Acting on pointerDOWN preempts Radix's
                        // own handler entirely; stopping pointerUp too covers any Radix build that
                        // selects there instead.
                        onPointerDown={(e) => {
                          if (missing <= 0) return
                          e.stopPropagation()
                          e.preventDefault()
                          onPickService(s.serviceId, true)
                        }}
                        onPointerUp={(e) => missing > 0 && e.stopPropagation()}
                        onClick={(e) => missing > 0 && e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (missing > 0 && (e.key === "Enter" || e.key === " ")) {
                            e.stopPropagation()
                            e.preventDefault()
                            onPickService(s.serviceId, true)
                          }
                        }}
                        title={missing > 0 ? t("serviceArrivedPendingHint") : undefined}
                        className={cn(
                          "shrink-0 rounded px-1 text-xs tabular-nums",
                          missing > 0 ? "font-semibold text-destructive hover:underline" : "text-muted-foreground"
                        )}
                      >
                        {s.arrived}/{s.attended}
                      </span>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        ) : (
          <DropdownMenuRadioGroup
            value={consultSubtypeFilter ?? SUB_FILTER_ALL}
            onValueChange={(v) => onPickConsultSubtype(v === SUB_FILTER_ALL ? null : v)}
          >
            <DropdownMenuRadioItem value={SUB_FILTER_ALL}>{t("allTypes")}</DropdownMenuRadioItem>
            {consultSubtypes.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.slug}>
                {tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.slug}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
