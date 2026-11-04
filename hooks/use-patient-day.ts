"use client"

import * as React from "react"

import {
  getFrontdeskTablero as getServiceBoard,
  getFrontdeskTabs,
  listSesionesRango as listSessions,
  type FrontdeskTab,
  type FrontdeskTablero as ServiceBoard,
  type Sesion as Session,
} from "@/lib/api/frontdesk"
import {
  getServicios as getServices,
  type Servicio as Service,
} from "@/lib/api/servicios"
import {
  getDefinicion as getBoardDefinition,
  getFilas as getBoardRows,
  type Tablero as BoardRows,
  type TableroDefinicion as BoardDefinition,
} from "@/lib/api/tablero"
import {
  groupByPatient,
  type DayService,
  type PatientDay,
} from "@/lib/frontdesk/patient-day"
import { useResource } from "@/hooks/use-resource"
import { useCitaStream as useLiveStream } from "@/hooks/use-cita-stream"

export interface PatientDayData {
  patients: PatientDay[]
  sessionsById: Map<string, Session>
  // Filled by the desk from useServiceBoards (only the open patient's services).
  boardsBySlug: Record<string, ServiceBoard>
  dayServices: DayService[]
  refreshTick: number
  servicesById: Map<string, Service>
  serviceDefinition: BoardDefinition | null
  consultations: BoardRows | null
  consultationDefinition: BoardDefinition | null
  consultationTab: FrontdeskTab | null
  loading: boolean
  error: string | null
  live: boolean
  refresh: () => void
  // Whether a consultation status is final (the board catalog's isTerminal).
  isConsultationTerminal: (status: string) => boolean
}

// Everything the patient desk shows for one center and day: the day's sessions across ALL services
// (one call), the
// consultation board, and the definitions that drive the flow. Live: any frontdesk or consultation
// event refetches (same single SSE bus as the frontdesk), with the hook's focus/poll safety nets.
export function usePatientDay(
  centerId: string | undefined,
  date: string
): Omit<PatientDayData, "boardsBySlug"> {
  const tabsRes = useResource<FrontdeskTab[]>(
    () =>
      centerId
        ? getFrontdeskTabs(centerId).catch(() => [])
        : Promise.resolve([]),
    [centerId]
  )
  const servicesRes = useResource<Service[]>(
    () => (centerId ? getServices(centerId) : Promise.resolve([])),
    [centerId]
  )
  const serviceDefRes = useResource<BoardDefinition | null>(
    () =>
      centerId
        ? getBoardDefinition("servicios", centerId)
        : Promise.resolve(null),
    [centerId]
  )
  const consultDefRes = useResource<BoardDefinition | null>(
    () =>
      centerId
        ? getBoardDefinition("atencion", centerId).catch(() => null)
        : Promise.resolve(null),
    [centerId]
  )
  // A failed REFETCH (429, network blip) keeps the last good day on screen: dropping to an empty list
  // is what "closed everything" at the desk on 04-nov-2026. A failed FIRST load still reports the error.
  const lastSessions = React.useRef<{ key: string; data: Session[] } | null>(null)
  const lastConsult = React.useRef<{ key: string; data: BoardRows } | null>(null)
  const dayKey = `${centerId ?? ""}|${date}`
  const sessionsRes = useResource<Session[]>(
    () =>
      centerId
        ? listSessions({ desde: date, hasta: date, centroId: centerId })
            .then((data) => {
              lastSessions.current = { key: dayKey, data }
              return data
            })
            .catch((err: unknown) => {
              if (lastSessions.current?.key === dayKey) return lastSessions.current.data
              throw err
            })
        : Promise.resolve([]),
    [centerId, date]
  )
  const consultRes = useResource<BoardRows | null>(
    () =>
      centerId
        ? getBoardRows("atencion", date, { centroId: centerId })
            .then((data) => {
              lastConsult.current = { key: dayKey, data }
              return data
            })
            .catch(() =>
              lastConsult.current?.key === dayKey ? lastConsult.current.data : null
            )
        : Promise.resolve(null),
    [centerId, date]
  )

  const tabs = React.useMemo(
    () => (tabsRes.state.kind === "ok" ? tabsRes.state.data : []),
    [tabsRes.state]
  )
  const sessions = React.useMemo(
    () => (sessionsRes.state.kind === "ok" ? sessionsRes.state.data : []),
    [sessionsRes.state]
  )
  const servicesById = React.useMemo(
    () =>
      new Map(
        (servicesRes.state.kind === "ok" ? servicesRes.state.data : []).map(
          (s) => [s.id, s]
        )
      ),
    [servicesRes.state]
  )

  // The day's services, in the frontdesk tab order, with their tab color.
  const dayServices = React.useMemo<DayService[]>(() => {
    const out: DayService[] = []
    for (const tab of tabs) {
      if (tab.boardSlug !== "servicios" || !tab.serviceId) continue
      const s = servicesById.get(tab.serviceId)
      out.push({
        id: tab.serviceId,
        slug: tab.slug,
        name: s?.name ?? tab.name,
        color: tab.color ?? null,
        requiresTechnician: s?.requiresTechnician,
        requiresNurse: s?.requiresNurse,
      })
    }
    return out
  }, [tabs, servicesById])

  const consultations =
    consultRes.state.kind === "ok" ? consultRes.state.data : null
  // Final consultation statuses come from the board's catalog (isTerminal), not from code.
  const consultTerminal = React.useMemo(
    () =>
      new Set(
        (consultDefRes.state.kind === "ok"
          ? (consultDefRes.state.data?.statuses ?? [])
          : []
        )
          .filter((x) => x.isTerminal)
          .map((x) => x.slug)
      ),
    [consultDefRes.state]
  )
  const isConsultationTerminal = React.useCallback(
    (status: string) => consultTerminal.has(status),
    [consultTerminal]
  )
  const patients = React.useMemo(
    () =>
      groupByPatient(
        sessions.map((s) => ({
          ...s,
          patientId: String(s.patientId),
          serviceId: String(s.serviceId),
        })),
        (consultations?.rows ?? []) as { id: string }[],
        dayServices,
        (status) => consultTerminal.has(status)
      ),
    [sessions, consultations, dayServices, consultTerminal]
  )
  const sessionsById = React.useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions]
  )

  // Bumped on every refresh (action or live event) so the open patient's boards
  // (useServiceBoards) refetch together with the day.
  const [refreshTick, setRefreshTick] = React.useState(0)
  const refresh = React.useCallback(() => {
    sessionsRes.refresh()
    consultRes.refresh()
    setRefreshTick((n) => n + 1)
  }, [sessionsRes, consultRes])

  const { live } = useLiveStream({
    centroId: centerId ?? null,
    enabled: !!centerId,
    onInvalidate: refresh,
  })

  const fail = [sessionsRes, servicesRes, serviceDefRes]
    .map((r) => r.state)
    .find((s) => s.kind === "fail")
  return {
    patients,
    sessionsById,
    dayServices,
    refreshTick,
    servicesById,
    serviceDefinition:
      serviceDefRes.state.kind === "ok" ? serviceDefRes.state.data : null,
    consultations,
    consultationDefinition:
      consultDefRes.state.kind === "ok" ? consultDefRes.state.data : null,
    consultationTab: tabs.find((t) => t.boardSlug === "atencion") ?? null,
    loading:
      sessionsRes.state.kind === "loading" ||
      tabsRes.state.kind === "loading" ||
      servicesRes.state.kind === "loading",
    error: fail && fail.kind === "fail" ? fail.message : null,
    live,
    refresh,
    isConsultationTerminal,
  }
}

// The boards (columns + projected rows) of ONE patient's services — the open one. Fetching every
// service with sessions today on each refresh (~14 in Caguas) burst past the BE's 100 requests/min
// per person when a session was marked attended (RATE_LIMITED, owner 04-nov-2026).
export function useServiceBoards(
  centerId: string | undefined,
  date: string,
  slugs: string[],
  refreshTick: number
): Record<string, ServiceBoard> {
  const slugsKey = [...new Set(slugs)].sort().join(",")
  // Last good board per center/day/slug: a failed refetch (a 429, a network blip) keeps the table the
  // desk was looking at instead of blanking it to bare column titles.
  const lastGood = React.useRef(new Map<string, ServiceBoard>())
  const res = useResource<Record<string, ServiceBoard>>(
    () =>
      centerId && slugsKey
        ? Promise.all(
            slugsKey.split(",").map(async (slug) => {
              const key = `${centerId}|${date}|${slug}`
              // A rejected load (429 / blip) is retried twice with a pause before giving up.
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  const b = await getServiceBoard(slug, date, centerId)
                  lastGood.current.set(key, b)
                  return [slug, b] as const
                } catch {
                  if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
                }
              }
              // Still failing: the last good board, else NOTHING — the table shows its skeleton
              // instead of an empty board that reads as "0 sessions" (desk photo, 04-nov 13:51).
              const prev = lastGood.current.get(key)
              return prev ? ([slug, prev] as const) : null
            })
          ).then((pairs) =>
            Object.fromEntries(pairs.filter((p) => p !== null))
          )
        : Promise.resolve({}),
    [centerId, date, slugsKey]
  )
  // A refresh (action or live event) refetches in place, keeping the tables on screen meanwhile.
  const { refresh } = res
  React.useEffect(() => {
    if (refreshTick > 0) refresh()
  }, [refreshTick, refresh])
  return res.state.kind === "ok" ? res.state.data : {}
}
