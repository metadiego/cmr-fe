"use client"

import type * as React from "react"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"
import { isServiceDayComplete } from "@/lib/frontdesk/day-summary"
import type { PatientKind } from "@/lib/frontdesk/patient-day"
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

type Translate = { (key: string): string; has: (key: string) => boolean }

/** A consultation subtype's name on the patient desk: the short one ("Nuevo", owner 17-nov-2026)
 *  when there is one, else the board's full label. `t` is the patientDesk namespace. */
export function consultSubtypeLabel(s: { slug: string; labelKey: string }, t: Translate, tRoot: Translate): string {
  if (t.has(`subtypeShort.${s.slug}`)) return t(`subtypeShort.${s.slug}`)
  return tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.slug
}

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
  onOpenSummary,
  trigger,
}: {
  kind: PatientKind
  serviceFilter: string | null
  consultSubtypeFilter: string | null
  servicesToday: ServiceOfTheDay[]
  consultSubtypes: ConsultSubtype[]
  onPickService: (serviceId: string | null, pendingOnly?: boolean) => void
  onPickConsultSubtype: (subtype: string | null) => void
  /** A complete service (x/x): its count opens the day's summary (owner 18-nov-2026). */
  onOpenSummary?: (s: ServiceOfTheDay) => void
  /** What opens the menu: the active tab itself («Servicios ▾» / «Consulta ▾»), owner 17-nov-2026. */
  trigger: React.ReactElement
}) {
  const t = useTranslations("patientDesk")
  const tRoot = useTranslations()
  if (kind !== "services" && kind !== "consultation") return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {kind === "services" ? (
          <DropdownMenuRadioGroup
            value={serviceFilter ?? SUB_FILTER_ALL}
            onValueChange={(v) => onPickService(v === SUB_FILTER_ALL ? null : v)}
          >
            <DropdownMenuRadioItem value={SUB_FILTER_ALL}>{t("allServices")}</DropdownMenuRadioItem>
            {servicesToday.map((s) => {
              const missing = s.arrived - s.attended
              // Two actions on the count: missing → jump to who is pending; complete (x/x) → the day's
              // summary. Otherwise the count is plain text (that click is reserved for a later feature).
              const complete = !!onOpenSummary && isServiceDayComplete(s)
              const act = missing > 0 ? () => onPickService(s.serviceId, true) : complete ? () => onOpenSummary!(s) : null
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
                        role={act ? "button" : undefined}
                        tabIndex={act ? 0 : undefined}
                        // Radix selects the radio item on pointer-up (and closes the menu right
                        // then, unmounting it) — a plain onClick fires AFTER that, often with no
                        // live target left to dispatch to. Acting on pointerDOWN preempts Radix's
                        // own handler entirely; stopping pointerUp too covers any Radix build that
                        // selects there instead.
                        onPointerDown={(e) => {
                          if (!act) return
                          e.stopPropagation()
                          e.preventDefault()
                          act()
                        }}
                        onPointerUp={(e) => act && e.stopPropagation()}
                        onClick={(e) => act && e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (act && (e.key === "Enter" || e.key === " ")) {
                            e.stopPropagation()
                            e.preventDefault()
                            act()
                          }
                        }}
                        title={missing > 0 ? t("serviceArrivedPendingHint") : complete ? t("daySummary.open") : undefined}
                        className={cn(
                          "shrink-0 rounded px-1 text-xs tabular-nums",
                          missing > 0
                            ? "font-semibold text-destructive hover:underline"
                            : complete
                              ? "font-semibold text-success-foreground hover:underline"
                              : "text-muted-foreground"
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
                {consultSubtypeLabel(s, t, tRoot)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
