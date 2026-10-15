// The patient desk turns the frontdesk around: instead of one tab per therapy with its patients, ONE list
// of the day's patients (service sessions and consultations together), each with everything they have
// today. This module does the grouping — pure, so it is tested.

import { coincide as matches } from "./search.ts"

export interface DaySession {
  id: string
  patientId: string
  serviceId: string
  status?: string | null
  time?: string | null
  presentAt?: string | null
  patient?: {
    id?: string
    name?: string | null
    medicalRecordNumber?: string | null
  } | null
}

export interface DayConsultation {
  id: string
  pacienteId?: string | null // board rows of the consultation board (/board/rows) keep Spanish keys
  paciente?: unknown
  record?: unknown
  estado?: unknown
  presente?: unknown
  subtipo?: unknown // board's subtype catalog (e.g. nueva/seguimiento) — data-driven, see SubTipo
}

export interface DayService {
  id: string
  slug: string
  name: string
  color?: string | null
  // Who performs it — the service's own flags (Configuración → Servicios), data, not code.
  requiresTechnician?: boolean
  requiresNurse?: boolean
}

export interface PatientService {
  serviceId: string
  slug: string
  name: string
  color: string | null
  staffGroup: StaffGroup
  sessionIds: string[]
  statuses: string[]
}

// Who performs a service, in the order the filtered view groups the rest: technician only, nurse
// only, both, neither (owner, 14-oct-2026 — handoff patient-desk-orden-por-personal).
export type StaffGroup = 0 | 1 | 2 | 3
export function staffGroup(
  s: Pick<DayService, "requiresTechnician" | "requiresNurse"> | undefined
): StaffGroup {
  const tech = !!s?.requiresTechnician
  const nurse = !!s?.requiresNurse
  return tech && nurse ? 2 : tech ? 0 : nurse ? 1 : 3
}

export interface PatientDay {
  patientId: string
  name: string
  record: string
  services: PatientService[]
  consultationIds: string[]
  consultationStatuses: string[]
  consultationSubtypes: string[] // parallel to consultationIds/consultationStatuses
  // The order the patient's sections (services + consultation) are drawn in, set by orderSections.
  // Absent = the configured order (services, then the consultation).
  sections?: PatientSection[]
  earliestTime: string | null // HH:MM of the first booking of the day
  presentAt: string | null // first arrival stamp (any service or the consultation)
  allCancelled: boolean
}

const text = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v)
const minIso = (a: string | null, b: string | null | undefined) =>
  !b ? a : !a || b < a ? b : a

export function groupByPatient(
  sessions: DaySession[],
  consultations: DayConsultation[],
  services: DayService[],
  isConsultationTerminal: IsTerminal = noneTerminal
): PatientDay[] {
  const svc = new Map(services.map((s) => [s.id, s]))
  const map = new Map<string, PatientDay>()
  const get = (id: string, name: string, record: string) => {
    let p = map.get(id)
    if (!p) {
      p = {
        patientId: id,
        name,
        record,
        services: [],
        consultationIds: [],
        consultationStatuses: [],
        consultationSubtypes: [],
        earliestTime: null,
        presentAt: null,
        allCancelled: true,
      }
      map.set(id, p)
    }
    if (!p.name && name) p.name = name
    if (!p.record && record) p.record = record
    return p
  }

  for (const s of sessions) {
    if (!s.patientId) continue
    const p = get(
      s.patientId,
      text(s.patient?.name),
      text(s.patient?.medicalRecordNumber)
    )
    const meta = svc.get(s.serviceId)
    let ps = p.services.find((x) => x.serviceId === s.serviceId)
    if (!ps) {
      ps = {
        serviceId: s.serviceId,
        slug: meta?.slug ?? "",
        name: meta?.name ?? "",
        color: meta?.color ?? null,
        staffGroup: staffGroup(meta),
        sessionIds: [],
        statuses: [],
      }
      p.services.push(ps)
    }
    ps.sessionIds.push(s.id)
    ps.statuses.push(text(s.status))
    const cancelled = s.status === "cancelada"
    if (!cancelled) p.allCancelled = false
    p.earliestTime = minIso(p.earliestTime, s.time ? s.time.slice(0, 5) : null)
    // A cancelled session keeps its OWN presentAt stamp (history), but it must not make the PATIENT
    // look arrived forever — found live 10-oct-2026 while building the header's "Presente": cancel a
    // walk-in session and its leftover presentAt kept outranking a genuinely pending one.
    if (!cancelled) p.presentAt = minIso(p.presentAt, s.presentAt)
  }

  for (const c of consultations) {
    const id = text(c.pacienteId)
    if (!id) continue
    const p = get(id, text(c.paciente), text(c.record))
    p.consultationIds.push(c.id)
    const status = text(c.estado)
    p.consultationStatuses.push(status)
    p.consultationSubtypes.push(text(c.subtipo))
    const cancelled = status === "cancelada"
    if (!cancelled) p.allCancelled = false
    if (!cancelled) p.presentAt = minIso(p.presentAt, text(c.presente) || null)
  }

  // A cancelled session is not a session (handoff patient-desk-cancelada-no-es-sesion, 14-oct-2026):
  // when the service has a live one that day, its cancelled rows are dropped — not drawn, not counted,
  // not in the chips. Only a service with nothing but cancelled rows keeps them, for a discreet mark.
  for (const p of map.values())
    for (const ps of p.services) {
      const live = ps.statuses
        .map((x, i) => (x === "cancelada" ? -1 : i))
        .filter((i) => i >= 0)
      if (live.length === 0 || live.length === ps.statuses.length) continue
      ps.sessionIds = live.map((i) => ps.sessionIds[i])
      ps.statuses = live.map((i) => ps.statuses[i])
    }

  // Services in the configured order (the order of `services`), not in arrival order.
  const order = new Map(services.map((s, i) => [s.id, i]))
  for (const p of map.values())
    p.services.sort(
      (a, b) => (order.get(a.serviceId) ?? 99) - (order.get(b.serviceId) ?? 99)
    )

  return sortPatients([...map.values()], isConsultationTerminal)
}

// A service is concluded when every session of it is attended ('asistido'); cancelled sessions are
// not pending, so they do not hold it open — but at least one must have been attended.
// Every session of the service that day was cancelled (the rows were kept only for a discreet mark).
export function serviceCancelledOnly(s: PatientService): boolean {
  return s.statuses.length > 0 && s.statuses.every((x) => x === "cancelada")
}

export function serviceConcluded(s: PatientService): boolean {
  const live = s.statuses.filter((x) => x !== "cancelada")
  return live.length > 0 && live.every((x) => x === "asistido")
}

// Terminal consultation statuses that mean the patient was NOT seen (left, cancelled). Terminal comes
// from the board's status catalog (isTerminal); these two only tell "finished" from "never seen".
const CONSULTATION_NOT_SEEN = new Set(["cancelada", "no_show"])

// Which consultation statuses are final, from the consultation board's definition. Empty = none known,
// so every consultation counts as still open.
export type IsTerminal = (status: string) => boolean
const noneTerminal: IsTerminal = () => false

// A patient is done for the day when nothing is still open — every service session attended or
// cancelled, every consultation in a terminal status — and something was actually attended (a session,
// or a consultation that ended without being cancelled or a no-show).
export function patientConcluded(
  p: PatientDay,
  isTerminal: IsTerminal = noneTerminal
): boolean {
  const sessions = p.services.flatMap((s) => s.statuses)
  if (sessions.some((x) => x !== "asistido" && x !== "cancelada")) return false
  if (p.consultationStatuses.some((x) => !isTerminal(x))) return false
  return (
    sessions.includes("asistido") ||
    p.consultationStatuses.some((x) => !CONSULTATION_NOT_SEEN.has(x))
  )
}

// Rank in the list: still in progress, then done for the day (sunk to the bottom, owner 10-oct-2026),
// then fully cancelled days.
const rank = (p: PatientDay, isTerminal: IsTerminal) =>
  p.allCancelled ? 2 : patientConcluded(p, isTerminal) ? 1 : 0

// Who is here first (by arrival), then who is booked earliest, then by name — within each rank, so
// patients that sink keep among themselves the order they had.
export function sortPatients(
  list: PatientDay[],
  isTerminal: IsTerminal = noneTerminal
): PatientDay[] {
  return list.slice().sort((a, b) => {
    const ra = rank(a, isTerminal)
    const rb = rank(b, isTerminal)
    if (ra !== rb) return ra - rb
    if (a.presentAt && b.presentAt)
      return a.presentAt.localeCompare(b.presentAt)
    if (a.presentAt || b.presentAt) return a.presentAt ? -1 : 1
    if (a.earliestTime && b.earliestTime && a.earliestTime !== b.earliestTime)
      return a.earliestTime.localeCompare(b.earliestTime)
    if (a.earliestTime !== b.earliestTime) return a.earliestTime ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// Accent- and case-insensitive search over name, record and the names of the patient's services.
export function filterPatients(
  list: PatientDay[],
  query: string
): PatientDay[] {
  if (!query.trim()) return list
  return list.filter((p) =>
    matches([p.name, p.record, ...p.services.map((s) => s.name)], query)
  )
}

// What the desk shows: everyone, only patients with service sessions, or only those with a consultation.
export type PatientKind = "all" | "services" | "consultation"

export function filterByKind(
  list: PatientDay[],
  kind: PatientKind
): PatientDay[] {
  if (kind === "services") return list.filter((p) => p.services.length > 0)
  if (kind === "consultation")
    return list.filter((p) => p.consultationIds.length > 0)
  return list
}

// Narrows "Servicios" to ONE service (data-driven: whichever services the day's patients actually
// have — see servicesOfTheDay). `null` clears it. That service also moves FIRST in each patient's
// services (chips and detail), so whoever works it finds it without scrolling (owner 13-oct-2026);
// the rest follow grouped by who performs them, starting with the SAME staff as the filtered one (filter
// Vit C, a nurse service → the other nurse services next, then technician, both, neither; owner
// 14-oct-2026) — each group in the configured order (the sort is stable and the list arrives in it).
export function filterByService(
  list: PatientDay[],
  serviceId: string | null
): PatientDay[] {
  if (!serviceId) return list
  return list
    .filter((p) => p.services.some((s) => s.serviceId === serviceId))
    .map((p) => {
      const same = p.services.find((s) => s.serviceId === serviceId)!.staffGroup
      const rank = (g: StaffGroup) => (g === same ? -1 : g)
      return {
        ...p,
        services: [
          ...p.services.filter((s) => s.serviceId === serviceId),
          ...p.services
            .filter((s) => s.serviceId !== serviceId)
            .sort((a, b) => rank(a.staffGroup) - rank(b.staffGroup)),
        ],
      }
    })
}

// Narrows "Consulta" to one subtype (e.g. nueva/seguimiento — the board's own catalog, see
// TableroDefinicion.subtypes). `null` clears it.
export function filterByConsultationSubtype(
  list: PatientDay[],
  subtype: string | null
): PatientDay[] {
  if (!subtype) return list
  return list.filter((p) => p.consultationSubtypes.includes(subtype))
}

// The services actually present today, in first-seen order, for the "Servicios" sub-filter — never
// a static catalog: a service nobody has today does not clutter the dropdown.
export function servicesOfTheDay(
  list: PatientDay[]
): { serviceId: string; name: string; color: string | null }[] {
  const out: { serviceId: string; name: string; color: string | null }[] = []
  const seen = new Set<string>()
  for (const p of list) {
    for (const s of p.services) {
      if (seen.has(s.serviceId)) continue
      seen.add(s.serviceId)
      out.push({ serviceId: s.serviceId, name: s.name, color: s.color })
    }
  }
  return out
}

// ─── Section order: what is still pending goes first (owner, 14-oct-2026) ──────────────────────────
// «Se trabaja a favor del paciente: lo que le falta es lo importante.» Handoff
// patient-desk-lo-pendiente-primero. One place for the order: chips and detail both read `sections`.

export type PatientSection =
  | { kind: "service"; service: PatientService }
  | { kind: "consultation" }

// Something of the service is still to do: a live session that is not attended.
export function servicePending(s: PatientService): boolean {
  return s.statuses.some((x) => x !== "asistido" && x !== "cancelada")
}

// The consultation is still to do while any of its statuses is not terminal (board catalog).
export function consultationPending(
  p: PatientDay,
  isTerminal: IsTerminal = noneTerminal
): boolean {
  return p.consultationStatuses.some((x) => !isTerminal(x))
}

// The configured order: services as they come, then the consultation.
export function defaultSections(p: PatientDay): PatientSection[] {
  const out: PatientSection[] = p.services.map((service) => ({
    kind: "service",
    service,
  }))
  if (p.consultationIds.length > 0) out.push({ kind: "consultation" })
  return out
}

export function patientSections(p: PatientDay): PatientSection[] {
  return p.sections ?? defaultSections(p)
}

// Without a service filter: pending sections first, finished after, each group in the configured order.
// With one, the filter is canonical (filterByService's order) and this does not reorder anything.
export function orderSections(
  list: PatientDay[],
  opts: { serviceFiltered: boolean; isTerminal?: IsTerminal }
): PatientDay[] {
  if (opts.serviceFiltered) return list
  const isTerminal = opts.isTerminal ?? noneTerminal
  return list.map((p) => {
    const base = defaultSections(p)
    const pending = (x: PatientSection) =>
      x.kind === "service"
        ? servicePending(x.service)
        : consultationPending(p, isTerminal)
    return {
      ...p,
      sections: [...base.filter(pending), ...base.filter((x) => !pending(x))],
    }
  })
}
