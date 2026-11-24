"use client"

import * as React from "react"

import {
  dropPastTimes,
  type DaySlots,
} from "@/lib/agenda/booking/availability"
import {
  bookableDays,
  dayKind,
  monthOf,
  monthWeeks,
  shiftMonth,
} from "@/lib/agenda/booking/month"
import { bookableWeekDays } from "@/lib/agenda/booking/week"
import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getBookingHolidays } from "@/lib/api/festivos"
import { nowTimePR, todayPR } from "@/lib/format/fecha"
import { useResource } from "@/hooks/use-resource"
import {
  useBookingLive,
  useDayAvailability,
  useMonthAvailability,
  type DayResult,
} from "@/hooks/use-booking-availability"

// Everything the booking calendar reads: the center's holidays, the visible month's free spots, the
// selected day (with the patient's limits for services) and the live refresh. (The "Next free" strip
// and its next-month lookahead were removed, owner 2026-11-23.)
// The screen owns one of these so its header can show the Live pill and its actions can refresh dates.

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
  live: boolean
  /** Re-asks these dates in the month, the week and the selected day when it is among them. */
  refreshDates: (dates: string[]) => void
  retryDay: (date: string) => void
  retrySelected: () => void
}

function isDaySlots(d: DayResult | undefined): d is DaySlots {
  return !!d && d !== "error"
}

/** Today's past times removed from every loaded day (the month and the day panel agree). */
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

function allError(dates: string[]): Record<string, DayResult> {
  return Object.fromEntries(dates.map((d) => [d, "error" as const]))
}

export function useBookingCalendar(p: {
  center: string | undefined
  kind: BookingKind | undefined
  typeId: string | undefined
  month: { year: number; month0: number }
  date: string | undefined
  patientId: string | undefined
  /** Week view: the six shown days (Mon–Sat); [] in the other views. */
  week: string[]
}): BookingCalendarData {
  const { center, kind, typeId, month, date, patientId } = p
  const todayIso = todayPR()
  const weeks = React.useMemo(
    () => monthWeeks(month.year, month.month0),
    [month.year, month.month0]
  )
  const next = shiftMonth(month, 1)

  // Holidays of the visible month's year and of the next month's (they differ in December), and of the
  // shown week's Monday (a week starting in late December while the month is January).
  const weekYear = p.week[0] ? Number(p.week[0].slice(0, 4)) : month.year
  const years = Array.from(new Set([weekYear, month.year, next.year])).sort()
  const holidaysRes = useResource<string[]>(
    () =>
      center && kind
        ? getBookingHolidays(years, center)
        : Promise.resolve([]),
    [center, !!kind, years.join(",")]
  )
  // A failed holiday load is an ERROR, never "no holidays": medical available-slots does not check
  // holidays, so an empty list would show a holiday as bookable. Every bookable day then shows the
  // usual error cell, and its Retry re-asks the holidays (nothing else is asked until they answer).
  const holidaysReady = holidaysRes.state.kind === "ok"
  const holidaysFailed = holidaysRes.state.kind === "fail"
  const reloadHolidays = holidaysRes.reload
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
    closedKind === "sunday" || closedKind === "holiday" || !holidaysReady
      ? undefined
      : date
  const dayAv = useDayAvailability({ center, kind, typeId, date: askDate, patientId })
  // A medical day is the same request (and cache entry) as the month's copy: while the month or the
  // week holds the date, read and refresh it there, so a refresh asks for it once.
  const monthEntry = date
    ? (monthDays[date] ?? weekAv.days[date])
    : undefined
  const dayFromMonth = kind === "medical" && monthEntry !== undefined
  const rawDay = dayFromMonth ? monthEntry : (dayAv.day ?? monthEntry)
  const day =
    holidaysFailed && date && closedKind !== "sunday" && closedKind !== "past"
      ? ("error" as const)
      : isDaySlots(rawDay)
        ? dropPastTimes(rawDay, todayIso, nowTime)
        : rawDay

  // Holidays failed: every day that would have been asked is an error cell (retry = the holidays).
  const failedMonth = React.useMemo(
    () => (holidaysFailed ? allError(bookableDays(weeks, month.month0, todayIso, [])) : null),
    [holidaysFailed, weeks, month.month0, todayIso]
  )
  const failedWeek = React.useMemo(
    () => (holidaysFailed && weekKey ? allError(bookableWeekDays(weekKey.split(","), todayIso, [])) : null),
    [holidaysFailed, weekKey, todayIso]
  )

  const monthRefresh = monthAv.refresh
  const weekRefresh = weekAv.refresh
  const dayRefresh = dayAv.refresh
  const refreshDates = React.useCallback(
    (dates: string[]) => {
      const inVisible = dates.filter((d) => monthDates.includes(d))
      if (inVisible.length > 0) monthRefresh(inVisible)
      // The week's days the month just re-asked only re-read; the rest are re-asked here.
      const inWeek = dates.filter((d) => weekDates.includes(d))
      const shared = inWeek.filter((d) => inVisible.includes(d))
      const own = inWeek.filter((d) => !shared.includes(d))
      if (shared.length > 0) weekRefresh(shared, false)
      if (own.length > 0) weekRefresh(own)
      // Service days asked with a patient are cached apart from the month's: refresh the day itself.
      // A medical day held by the month or the week was just refreshed there.
      const held = [...monthDates, ...weekDates]
      const coveredByMonth = kind === "medical" && held.includes(date ?? "")
      if (date && dates.includes(date) && !coveredByMonth) dayRefresh()
    },
    [kind, monthDates, weekDates, date, monthRefresh, weekRefresh, dayRefresh]
  )

  const liveVisible = React.useMemo(
    () => [...new Set([...monthDates, ...weekDates, ...(date ? [date] : [])])],
    [monthDates, weekDates, date]
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
    days: failedMonth ?? monthDays,
    weekDays: failedWeek ?? weekDays,
    loading: monthAv.loading || holidaysRes.state.kind === "loading",
    notConfigured: monthAv.notConfigured || weekAv.notConfigured,
    day,
    live,
    refreshDates,
    // Re-asks the day wherever it is shown (month, week).
    retryDay: (d: string) => (holidaysFailed ? reloadHolidays() : refreshDates([d])),
    retrySelected: () =>
      holidaysFailed
        ? reloadHolidays()
        : dayFromMonth && date
          ? refreshDates([date])
          : dayRefresh(),
  }
}
