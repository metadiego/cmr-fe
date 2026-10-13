"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, FilterIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"

// The appointment the day view is narrowed to, in the URL (`?cita=<id>`) so it survives the jump to
// another day and a reload. After saving, the view goes to the appointment's day showing only it
// (owner, 13-oct-2026); the banner clears it. Pure narrowing lives in lib/agenda/focus-appointment.ts.
export function useAppointmentFocus(dayPath: (date: string) => string) {
  const router = useRouter()
  const pathname = usePathname()
  const focus = useSearchParams().get("cita")
  const focusOn = React.useCallback(
    (cita: { id: string; date?: string | null }) =>
      router.push(
        `${cita.date ? dayPath(String(cita.date).slice(0, 10)) : pathname}?cita=${cita.id}`
      ),
    [router, pathname, dayPath]
  )
  const clear = React.useCallback(
    () => router.replace(pathname),
    [router, pathname]
  )
  return { focus, focusOn, clear }
}

export function AppointmentFocusBanner({ onClear }: { onClear: () => void }) {
  const t = useTranslations("agenda.dia")
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm ring-1 ring-primary/30">
      <HugeiconsIcon icon={FilterIcon} className="size-4 text-primary" />
      <span className="font-medium">{t("focusOnSaved")}</span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto h-7 gap-1"
        onClick={onClear}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        {t("focusClear")}
      </Button>
    </div>
  )
}
