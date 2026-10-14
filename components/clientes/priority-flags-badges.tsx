"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Settings02Icon } from "@hugeicons/core-free-icons"

import {
  getPriorityFlagTypes,
  getPatientPriorityFlags,
  addPatientPriorityFlag,
  removePatientPriorityFlag,
  type PriorityFlagType,
  type PatientPriorityFlag,
} from "@/lib/api/pacientes"
import {
  resolvePriorityFlagIcon,
  resolvePriorityFlagColorClass,
} from "@/lib/pacientes/priority-flags"
import { toastError } from "@/lib/api/errors"
import { useResource } from "@/hooks/use-resource"
import { useCan } from "@/hooks/use-can"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Banderas de prioridad del paciente (oxígeno, silla de ruedas…): badges de un vistazo + un
// desplegable para marcar/quitar, sin pantalla aparte ni "guardar" en bloque (una llamada por
// cambio, idempotente del lado del BE). Handoff HANDOFF-banderas-de-prioridad-del-paciente.md.
// A single flag as a pill. `compact` is the size used in lists (the patient desk's left column).
export function PriorityFlagPill({
  flag,
  label,
  compact,
}: {
  flag: PatientPriorityFlag
  label: string
  compact?: boolean
}) {
  return (
    <span
      title={flag.note || label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1",
        compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs",
        resolvePriorityFlagColorClass(flag.color)
      )}
    >
      <HugeiconsIcon
        icon={resolvePriorityFlagIcon(flag.icon)}
        className={compact ? "size-3" : "size-3.5"}
      />
      {label}
    </span>
  )
}

// `showBadges={false}` leaves only the add/remove menu, for screens that show the flags elsewhere;
// `onChange` runs after each successful change so those screens can refresh them.
export function PriorityFlagsBadges({
  patientId,
  centroId,
  showBadges = true,
  onChange,
}: {
  patientId: string
  centroId?: string
  showBadges?: boolean
  onChange?: () => void
}) {
  const t = useTranslations("patients.priorityFlags")
  const tRoot = useTranslations()
  const { can } = useCan()
  const puedeEscribir = can("pacientes.prioridad_flags.write")
  const puedeAdmin = can("pacientes.prioridad_flags.admin")

  const flagsRes = useResource<PatientPriorityFlag[]>(
    () => getPatientPriorityFlags(patientId, centroId),
    [patientId, centroId]
  )
  const catalogRes = useResource<PriorityFlagType[]>(
    () => getPriorityFlagTypes(),
    []
  )
  const flags = flagsRes.state.kind === "ok" ? flagsRes.state.data : []
  const catalog = (
    catalogRes.state.kind === "ok" ? catalogRes.state.data : []
  ).filter((c) => c.active)
  const activeSlugs = new Set(flags.map((f) => f.slug))
  const [busySlug, setBusySlug] = React.useState<string | null>(null)
  const label = (f: { labelKey: string; slug: string }) =>
    tRoot.has(f.labelKey) ? tRoot(f.labelKey) : f.slug

  async function toggle(type: PriorityFlagType, on: boolean) {
    if (busySlug) return
    setBusySlug(type.slug)
    try {
      if (on)
        await addPatientPriorityFlag(patientId, type.id, undefined, centroId)
      else await removePatientPriorityFlag(patientId, type.id, centroId)
      toast.success(t(on ? "added" : "removed"))
      flagsRes.reload()
      onChange?.()
    } catch (err) {
      toastError(err, tRoot)
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showBadges &&
        flags.map((f) => (
          <PriorityFlagPill key={f.slug} flag={f} label={label(f)} />
        ))}
      {puedeEscribir && catalog.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 rounded-full px-2 text-xs"
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3" />
              {t("add")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t("manage")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {catalog.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={activeSlugs.has(c.slug)}
                disabled={busySlug === c.slug}
                onCheckedChange={(v) => toggle(c, v === true)}
              >
                {label(c)}
              </DropdownMenuCheckboxItem>
            ))}
            {puedeAdmin && (
              <>
                <DropdownMenuSeparator />
                <Link
                  href="/configuration/priority-flags"
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
                  {tRoot("configuracion.prioridadFlags.title")}
                </Link>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  )
}
