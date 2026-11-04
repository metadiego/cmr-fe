"use client"

import * as React from "react"

import {
  fromMedicalBands,
  fromServiceAvailability,
  type DaySlots,
} from "@/lib/agenda/booking/availability"
import {
  datesToRefresh,
  dayKey,
  isCurrent,
  runLimited,
} from "@/lib/agenda/booking/day-cache"
import type { BookingKind } from "@/lib/agenda/booking/url-state"
import { getCuposLibres } from "@/lib/api/citas"
import { getAvailability } from "@/lib/api/resources"
import { useCitaStream } from "@/hooks/use-cita-stream"

// Availability data for the booking calendar: a month of days (cached, 6 requests at a time) and one
// day (with the patient's limits), both refreshable by date, plus the live-refresh wiring.

export type DayResult = DaySlots | null | "error"

const MONTH_CONCURRENCY = 6
const CACHE_TTL_MS = 60_000 // safety net when the live stream is down
const cache = new Map<string, { at: number; value: DaySlots | null }>()

function cached(key: string): DaySlots | null | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

// Requests in flight by cache key: the month, the week and the day asking for the same day at once
// share one request.
const inflight = new Map<string, Promise<DaySlots | null>>()

/** A refresh must not join a request that started before the change it reacts to. */
function forget(key: string): void {
  cache.delete(key)
  inflight.delete(key)
}

/** null = the service has no resource configured. Throws on a failed request (never cached). */
function fetchDay(
  center: string,
  kind: BookingKind,
  typeId: string,
  date: string,
  patientId?: string
): Promise<DaySlots | null> {
  const key = dayKey(
    center,
    kind,
    typeId,
    date,
    kind === "service" ? patientId : undefined
  )
  const running = inflight.get(key)
  if (running) return running
  const p = requestDay(center, kind, typeId, date, patientId).finally(() => {
    if (inflight.get(key) === p) inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}

async function requestDay(
  center: string,
  kind: BookingKind,
  typeId: string,
  date: string,
  patientId?: string
): Promise<DaySlots | null> {
  const key = dayKey(
    center,
    kind,
    typeId,
    date,
    kind === "service" ? patientId : undefined
  )
  let value: DaySlots | null
  if (kind === "medical") {
    const r = await getCuposLibres(date, typeId, center)
    value = fromMedicalBands(date, r.slots ?? r.franjas ?? [])
  } else {
    const a = await getAvailability(
      {
        date,
        serviceId: typeId,
        areas: 1,
        ...(patientId ? { patientId } : {}),
      },
      center,
      [center]
    )
    value = fromServiceAvailability(date, a)
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

export function useMonthAvailability(p: {
  center: string | undefined
  kind: BookingKind | undefined
  typeId: string | undefined
  dates: string[]
}): {
  days: Record<string, DayResult>
  loading: boolean
  notConfigured: boolean
  refresh: (dates?: string[], force?: boolean) => void
} {
  const { center, kind, typeId } = p
  const datesKey = p.dates.join(",")
  const scope =
    center && kind && typeId ? `${center}|${kind}|${typeId}|${datesKey}` : ""
  const [state, setState] = React.useState<{
    scope: string
    days: Record<string, DayResult>
    loading: boolean
  }>({ scope: "", days: {}, loading: false })
  const scopeRef = React.useRef(scope)
  const datesRef = React.useRef<string[]>(p.dates)
  React.useEffect(() => {
    scopeRef.current = scope
    datesRef.current = datesKey ? datesKey.split(",") : []
  })

  const load = React.useCallback(
    (dates: string[], requestScope: string) => {
      if (!center || !kind || !typeId || !requestScope) return
      const pending = dates.filter(
        (d) => cached(dayKey(center, kind, typeId, d)) === undefined
      )
      const fromCache: Record<string, DayResult> = {}
      for (const d of dates) {
        const hit = cached(dayKey(center, kind, typeId, d))
        if (hit !== undefined) fromCache[d] = hit
      }
      setState((s) => ({
        scope: requestScope,
        days: { ...(s.scope === requestScope ? s.days : {}), ...fromCache },
        loading: pending.length > 0,
      }))
      if (pending.length === 0) return
      void runLimited(
        pending.map((d) => async () => {
          // Skip queued work of a superseded generation (in-flight requests may still finish).
          if (!isCurrent(requestScope, scopeRef.current)) return
          let result: DayResult
          try {
            result = await fetchDay(center, kind, typeId, d)
          } catch {
            result = "error"
          }
          // A late answer for an old type/month/center must not paint the current one.
          if (!isCurrent(requestScope, scopeRef.current)) return
          setState((s) =>
            s.scope === requestScope
              ? { ...s, days: { ...s.days, [d]: result } }
              : s
          )
        }),
        MONTH_CONCURRENCY
      ).then(() => {
        if (!isCurrent(requestScope, scopeRef.current)) return
        setState((s) =>
          s.scope === requestScope ? { ...s, loading: false } : s
        )
      })
    },
    [center, kind, typeId]
  )

  React.useEffect(() => {
    if (!scope) return
    load(datesRef.current, scope)
  }, [scope, load])

  // `force: false` re-reads the dates without dropping them (another hook just refreshed them: this one
  // joins that request or reads its answer from the cache).
  const refresh = React.useCallback(
    (dates?: string[], force = true) => {
      if (!center || !kind || !typeId) return
      const target = dates ?? datesRef.current
      if (force) for (const d of target) forget(dayKey(center, kind, typeId, d))
      load(target, scopeRef.current)
    },
    [center, kind, typeId, load]
  )

  const days = state.scope === scope ? state.days : {}
  const loaded = Object.values(days)
  const notConfigured =
    kind === "service" && loaded.length > 0 && loaded.every((d) => d === null)
  return {
    days,
    loading: scope !== "" && (state.scope !== scope || state.loading),
    notConfigured,
    refresh,
  }
}

export function useDayAvailability(p: {
  center: string | undefined
  kind: BookingKind | undefined
  typeId: string | undefined
  date: string | undefined
  patientId?: string
}): { day: DayResult | undefined; refresh: () => void } {
  const { center, kind, typeId, date, patientId } = p
  const key =
    center && kind && typeId && date
      ? dayKey(
          center,
          kind,
          typeId,
          date,
          kind === "service" ? patientId : undefined
        )
      : ""
  const [state, setState] = React.useState<{ key: string; day: DayResult }>({
    key: "",
    day: "error",
  })
  const keyRef = React.useRef(key)
  React.useEffect(() => {
    keyRef.current = key
  })

  const load = React.useCallback(
    (force: boolean) => {
      if (!center || !kind || !typeId || !date || !key) return
      if (force) forget(key)
      const hit = cached(key)
      const source =
        hit !== undefined
          ? Promise.resolve(hit)
          : fetchDay(center, kind, typeId, date, patientId)
      source.then(
        (day) => {
          if (isCurrent(key, keyRef.current)) setState({ key, day })
        },
        () => {
          if (isCurrent(key, keyRef.current)) setState({ key, day: "error" })
        }
      )
    },
    [center, kind, typeId, date, patientId, key]
  )

  React.useEffect(() => {
    load(false)
  }, [load])

  const refresh = React.useCallback(() => load(true), [load])
  return { day: state.key === key && key ? state.day : undefined, refresh }
}

/**
 * Live refresh: collects the dates of cita/sesion events and, when the stream invalidates (debounced, or
 * the safety-net poll with no events), refreshes those dates, or every visible one when a date is unknown.
 */
export function useBookingLive(p: {
  center: string | undefined
  visible: string[]
  onRefresh: (dates: string[]) => void
}): { live: boolean } {
  const collected = React.useRef<(string | undefined)[]>([])
  const latest = React.useRef(p)
  React.useEffect(() => {
    latest.current = p
  })
  const { live } = useCitaStream({
    centroId: p.center,
    enabled: !!p.center,
    debounceMs: 400,
    onEvent: (e) => {
      collected.current.push(e.status?.date)
    },
    onInvalidate: () => {
      const events =
        collected.current.length > 0 ? collected.current : [undefined]
      collected.current = []
      const dates = datesToRefresh(events, latest.current.visible)
      if (dates.length > 0) latest.current.onRefresh(dates)
    },
  })
  return { live }
}
