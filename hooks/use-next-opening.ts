"use client"

import * as React from "react"

import { dropPastTimes } from "@/lib/agenda/booking/availability"
import {
  emptyRunStep,
  firstOpening,
  NEXT_OPENING_DAYS,
  scanDates,
} from "@/lib/agenda/booking/type-list"
import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { nowTimePR, todayPR } from "@/lib/format/fecha"
import { loadDay } from "@/hooks/use-booking-availability"

// "Next free" of one row of the type list: scans forward day by day, up to 14 bookable days, and stops
// at the first free time; a service gives up after EMPTY_RUN_LIMIT empty days in a row only while no day
// had any bookable time (see emptyRunStep). Uses the availability cache and the shared request queue; nothing is asked
// until `enabled` (the row is on screen), and a row that goes away stops its scan.

export type NextOpening =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; date: string; time: string }
  /** `scanned` bookable days were looked at; `early` = stopped before NEXT_OPENING_DAYS (nothing bookable). */
  | { state: "none"; scanned: number; early: boolean }
  | { state: "notConfigured" }
  | { state: "error" }

export function useNextOpening(p: {
  center: string | undefined
  kind: BookingKind
  typeId: string
  /** The center's holidays; null while they load (the scan waits for them). */
  holidays: string[] | null
  enabled: boolean
}): NextOpening {
  const { center, kind, typeId, holidays, enabled } = p
  const holidaysKey = holidays ? holidays.join(",") : null
  const key =
    enabled && center && holidaysKey !== null
      ? `${center}|${kind}|${typeId}|${holidaysKey}`
      : ""
  const [result, setResult] = React.useState<{ key: string; value: NextOpening }>({
    key: "",
    value: { state: "idle" },
  })

  React.useEffect(() => {
    if (!key || !center || holidaysKey === null) return
    let stopped = false
    const done = (value: NextOpening) => {
      if (!stopped) setResult({ key, value })
    }
    const scan = async () => {
      const today = todayPR()
      const now = nowTimePR()
      const days = scanDates(today, holidaysKey ? holidaysKey.split(",") : [], NEXT_OPENING_DAYS)
      let st = { run: 0, sawBookable: false }
      let scanned = 0
      for (const date of days) {
        let day
        try {
          day = await loadDay(center, kind, typeId, date, () => stopped)
        } catch {
          return done({ state: "error" })
        }
        if (stopped || day === undefined) return
        // Not configured is a property of the service, not of the day: no point asking further.
        if (day === null) return done({ state: "notConfigured" })
        const open = dropPastTimes(day, today, now)
        const time = firstOpening(open, { date: today, time: now })
        if (time) return done({ state: "found", date, time })
        scanned++
        const step = emptyRunStep(kind, st, day)
        if (step.stop) return done({ state: "none", scanned, early: true })
        st = step
      }
      done({ state: "none", scanned, early: false })
    }
    void scan()
    return () => {
      stopped = true
    }
  }, [key, center, kind, typeId, holidaysKey])

  if (!key) return { state: enabled ? "loading" : "idle" }
  return result.key === key ? result.value : { state: "loading" }
}
