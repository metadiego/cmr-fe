"use client"

import * as React from "react"

import {
  nextFree,
  type DaySlots,
  type TimeWindow,
} from "@/lib/agenda/booking/availability"
import { bookableDays, monthWeeks } from "@/lib/agenda/booking/month"
import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getFestivos, type Festivo } from "@/lib/api/festivos"
import { nowTimePR, todayPR } from "@/lib/format/fecha"
import { useResource } from "@/hooks/use-resource"
import {
  useBookingLive,
  useDayAvailability,
  useMonthAvailability,
  type DayResult,
} from "@/hooks/use-booking-availability"

// Everything the booking calendar reads: the center's holidays, the visible month's free spots, the
// selected day (with the patient's limits for services), the "Next free" strip and the live refresh.
// The screen owns one of these so its header can show the Live pill and its actions can refresh dates.

const NEXT_FREE_COUNT = 4
const NEXT_MONTH_LOOKAHEAD_DAYS = 14

export interface BookingCalendarData {
  todayIso: string
  weeks: string[][]
  holidays: string[]
  /** Free spots per day of the visible month (only bookable days are asked). */
  days: Record<string, DayResult>
  loading: boolean
  notConfigured: boolean
  /** The selected day: the day request (patient-aware), else the month's copy while it loads. */
  day: DayResult | undefined
  nextFree: { date: string; time: string }[]
  live: boolean
  /** Re-asks these dates in the month(s) and the selected day when it is among them. */
  refreshDates: (dates: string[]) => void
  retryDay: (date: string) => void
  retrySelected: () => void
}

function addMonth(m: { year: number; month0: number }) {
  return m.month0 === 11
    ? { year: m.year + 1, month0: 0 }
    : { year: m.year, month0: m.month0 + 1 }
}

function isDaySlots(d: DayResult | undefined): d is DaySlots {
  return !!d && d !== "error"
}

/** Blocking, active holidays as YYYY-MM-DD. */
function holidayDates(list: Festivo[]): string[] {
  return list
    .filter((f) => f.active !== false && f.blocksSchedule !== false)
    .map((f) => f.date.slice(0, 10))
}

export function useBookingCalendar(p: {
  center: string | undefined
  kind: BookingKind | undefined
  typeId: string | undefined
  month: { year: number; month0: number }
  date: string | undefined
  patientId: string | undefined
  window: TimeWindow
}): BookingCalendarData {
  const { center, kind, typeId, month, date, patientId, window } = p
  const todayIso = todayPR()
  const weeks = React.useMemo(
    () => monthWeeks(month.year, month.month0),
    [month.year, month.month0]
  )
  const next = addMonth(month)
  const isCurrentMonth =
    `${month.year}-${String(month.month0 + 1).padStart(2, "0")}` ===
    todayIso.slice(0, 7)

  // Holidays of the visible month's year and of the next month's (they differ in December).
  const years = Array.from(new Set([month.year, next.year]))
  const holidaysRes = useResource<string[]>(
    () =>
      center && kind
        ? Promise.all(
            years.map((anio) => getFestivos({ anio, centroId: center }))
          ).then((lists) => holidayDates(lists.flat()))
        : Promise.resolve([]),
    [center, !!kind, years.join(",")]
  )
  // A failed holiday load must not block the calendar: the day requests then say what is closed.
  const holidaysReady = holidaysRes.state.kind !== "loading"
  const holidays = React.useMemo(
    () => (holidaysRes.state.kind === "ok" ? holidaysRes.state.data : []),
    [holidaysRes.state]
  )

  // Wait for the holidays so the month is asked once, for its bookable days only.
  const monthDates = React.useMemo(
    () =>
      holidaysReady
        ? bookableDays(weeks, month.month0, todayIso, holidays)
        : [],
    [holidaysReady, weeks, month.month0, todayIso, holidays]
  )
  const monthAv = useMonthAvailability({
    center,
    kind,
    typeId,
    dates: monthDates,
  })

  const loadedDays = React.useMemo(
    () => Object.values(monthAv.days).filter(isDaySlots),
    [monthAv.days]
  )
  const from = { date: todayIso, time: nowTimePR() }
  const inMonth = nextFree(loadedDays, window, NEXT_FREE_COUNT, from)

  // Fewer than 4 free times left in the current month: also look at the start of the next one.
  const wantNext =
    isCurrentMonth &&
    holidaysReady &&
    !monthAv.loading &&
    inMonth.length < NEXT_FREE_COUNT
  const nextDates = React.useMemo(
    () =>
      wantNext
        ? bookableDays(
            monthWeeks(next.year, next.month0),
            next.month0,
            todayIso,
            holidays
          ).slice(0, NEXT_MONTH_LOOKAHEAD_DAYS)
        : [],
    [wantNext, next.year, next.month0, todayIso, holidays]
  )
  const nextAv = useMonthAvailability({ center, kind, typeId, dates: nextDates })
  const nextFreeTimes =
    inMonth.length >= NEXT_FREE_COUNT || nextDates.length === 0
      ? inMonth
      : nextFree(
          [
            ...loadedDays,
            ...Object.values(nextAv.days).filter(isDaySlots),
          ],
          window,
          NEXT_FREE_COUNT,
          from
        )

  const dayAv = useDayAvailability({ center, kind, typeId, date, patientId })
  const day = dayAv.day ?? (date ? monthAv.days[date] : undefined)

  const monthRefresh = monthAv.refresh
  const nextRefresh = nextAv.refresh
  const dayRefresh = dayAv.refresh
  const refreshDates = React.useCallback(
    (dates: string[]) => {
      const inVisible = dates.filter((d) => monthDates.includes(d))
      const inNext = dates.filter((d) => nextDates.includes(d))
      if (inVisible.length > 0) monthRefresh(inVisible)
      if (inNext.length > 0) nextRefresh(inNext)
      // Day entries asked with a patient are cached apart from the month's: refresh the day itself.
      if (date && dates.includes(date)) dayRefresh()
    },
    [monthDates, nextDates, date, monthRefresh, nextRefresh, dayRefresh]
  )

  const liveVisible = React.useMemo(
    () => [...monthDates, ...nextDates, ...(date ? [date] : [])],
    [monthDates, nextDates, date]
  )
  const { live } = useBookingLive({
    center: kind && typeId ? center : undefined,
    visible: liveVisible,
    onRefresh: refreshDates,
  })

  return {
    todayIso,
    weeks,
    holidays,
    days: monthAv.days,
    loading: monthAv.loading || !holidaysReady,
    notConfigured: monthAv.notConfigured,
    day,
    nextFree: nextFreeTimes,
    live,
    refreshDates,
    retryDay: (d: string) => monthRefresh([d]),
    retrySelected: dayRefresh,
  }
}
