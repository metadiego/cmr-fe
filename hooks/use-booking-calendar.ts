"use client"

import * as React from "react"

import {
  dropPastTimes,
  nextFree,
  type DaySlots,
  type TimeWindow,
} from "@/lib/agenda/booking/availability"
import {
  bookableDays,
  dayKind,
  monthOf,
  monthWeeks,
  shiftMonth,
} from "@/lib/agenda/booking/month"
import { holidayDates } from "@/lib/agenda/booking/holidays"
import { bookableWeekDays } from "@/lib/agenda/booking/week"
import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getFestivos } from "@/lib/api/festivos"
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
  /** Free spots per day of the visible month (only bookable days are asked); today without past times. */
  days: Record<string, DayResult>
  /** Week view: the shown week's bookable days, same shape as `days` (empty in the other views). */
  weekDays: Record<string, DayResult>
  loading: boolean
  notConfigured: boolean
  /** The selected day: the day request (patient-aware), else the month's copy while it loads. */
  day: DayResult | undefined
  nextFree: { date: string; time: string }[]
  /** The month or the next-month lookahead is still loading (so "none soon" is not final yet). */
  nextFreeLoading: boolean
  live: boolean
  /** Re-asks these dates in the month(s) and the selected day when it is among them. */
  refreshDates: (dates: string[]) => void
  retryDay: (date: string) => void
  retrySelected: () => void
}

function isDaySlots(d: DayResult | undefined): d is DaySlots {
  return !!d && d !== "error"
}

/** Today's past times removed from every loaded day (the month, the day panel and Next free agree). */
function withoutPast(
  days: Record<string, DayResult>,
  todayIso: string,
  nowTime: string
): Record<string, DayResult> {
  const out: Record<string, DayResult> = {}
  for (const [d, v] of Object.entries(days)) {
    out[d] = isDaySlots(v) ? dropPastTimes(v, todayIso, nowTime) : v
  }
  return out
}

export function useBookingCalendar(p: {
  center: string | undefined
  kind: BookingKind | undefined
  typeId: string | undefined
  month: { year: number; month0: number }
  date: string | undefined
  patientId: string | undefined
  window: TimeWindow
  /** Week view: the six shown days (Mon–Sat); [] in the other views. */
  week: string[]
}): BookingCalendarData {
  const { center, kind, typeId, month, date, patientId, window } = p
  const todayIso = todayPR()
  const weeks = React.useMemo(
    () => monthWeeks(month.year, month.month0),
    [month.year, month.month0]
  )
  const next = shiftMonth(month, 1)
  const isCurrentMonth =
    `${month.year}-${String(month.month0 + 1).padStart(2, "0")}` ===
    todayIso.slice(0, 7)

  // Holidays of the visible month's year and of the next month's (they differ in December), and of the
  // shown week's Monday (a week starting in late December while the month is January).
  const weekYear = p.week[0] ? Number(p.week[0].slice(0, 4)) : month.year
  const years = Array.from(new Set([weekYear, month.year, next.year])).sort()
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

  const nowTime = nowTimePR()
  const monthDays = React.useMemo(
    () => withoutPast(monthAv.days, todayIso, nowTime),
    [monthAv.days, todayIso, nowTime]
  )
  const loadedDays = React.useMemo(
    () => Object.values(monthDays).filter(isDaySlots),
    [monthDays]
  )
  const from = { date: todayIso, time: nowTime }
  const inMonth = nextFree(loadedDays, window, NEXT_FREE_COUNT, from)

  // Fewer than 4 free times left in the current month: also look at the start of the next one. Gated on
  // every month day having answered once (not on `loading`), so a live refresh or a retry in this month
  // does not drop the lookahead and its in-flight requests.
  const monthComplete =
    holidaysReady && monthDates.every((d) => d in monthAv.days)
  const wantNext =
    isCurrentMonth && monthComplete && inMonth.length < NEXT_FREE_COUNT
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

  // Week view: the shown week's days, through the same per-day cache (the month's copies are hits).
  const weekKey = p.week.join(",")
  const weekDates = React.useMemo(
    () =>
      holidaysReady && weekKey
        ? bookableWeekDays(weekKey.split(","), todayIso, holidays)
        : [],
    [holidaysReady, weekKey, todayIso, holidays]
  )
  const weekAv = useMonthAvailability({ center, kind, typeId, dates: weekDates })
  const weekDays = React.useMemo(
    () => withoutPast(weekAv.days, todayIso, nowTime),
    [weekAv.days, todayIso, nowTime]
  )

  // A closed day (Sunday, holiday: reachable in Day view) is never asked for.
  const closedKind = date
    ? dayKind(date, monthOf(date).month0, todayIso, holidays)
    : undefined
  const askDate =
    closedKind === "sunday" || closedKind === "holiday" ? undefined : date
  const dayAv = useDayAvailability({ center, kind, typeId, date: askDate, patientId })
  // A medical day is the same request (and cache entry) as the month's copy: while the month or the
  // lookahead holds the date, read and refresh it there, so a refresh asks for it once.
  const monthEntry = date
    ? (monthDays[date] ?? nextAv.days[date] ?? weekAv.days[date])
    : undefined
  const dayFromMonth = kind === "medical" && monthEntry !== undefined
  const rawDay = dayFromMonth ? monthEntry : (dayAv.day ?? monthEntry)
  const day = isDaySlots(rawDay) ? dropPastTimes(rawDay, todayIso, nowTime) : rawDay

  const monthRefresh = monthAv.refresh
  const nextRefresh = nextAv.refresh
  const weekRefresh = weekAv.refresh
  const dayRefresh = dayAv.refresh
  const refreshDates = React.useCallback(
    (dates: string[]) => {
      const inVisible = dates.filter((d) => monthDates.includes(d))
      const inNext = dates.filter((d) => nextDates.includes(d))
      if (inVisible.length > 0) monthRefresh(inVisible)
      if (inNext.length > 0) nextRefresh(inNext)
      // The week's days the month (or lookahead) just re-asked only re-read; the rest are re-asked here.
      const inWeek = dates.filter((d) => weekDates.includes(d))
      const shared = inWeek.filter((d) => inVisible.includes(d) || inNext.includes(d))
      const own = inWeek.filter((d) => !shared.includes(d))
      if (shared.length > 0) weekRefresh(shared, false)
      if (own.length > 0) weekRefresh(own)
      // Service days asked with a patient are cached apart from the month's: refresh the day itself.
      // A medical day held by the month or the week was just refreshed there.
      const held = [...monthDates, ...nextDates, ...weekDates]
      const coveredByMonth = kind === "medical" && held.includes(date ?? "")
      if (date && dates.includes(date) && !coveredByMonth) dayRefresh()
    },
    [kind, monthDates, nextDates, weekDates, date, monthRefresh, nextRefresh, weekRefresh, dayRefresh]
  )

  const liveVisible = React.useMemo(
    () => [...new Set([...monthDates, ...nextDates, ...weekDates, ...(date ? [date] : [])])],
    [monthDates, nextDates, weekDates, date]
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
    days: monthDays,
    weekDays,
    loading: monthAv.loading || !holidaysReady,
    notConfigured: monthAv.notConfigured || weekAv.notConfigured,
    day,
    nextFree: nextFreeTimes,
    nextFreeLoading:
      !monthComplete || (nextDates.length > 0 && nextAv.loading),
    live,
    refreshDates,
    // Re-asks the day wherever it is shown (month, lookahead, week).
    retryDay: (d: string) => refreshDates([d]),
    retrySelected: () =>
      dayFromMonth && date ? refreshDates([date]) : dayRefresh(),
  }
}
