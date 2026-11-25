// The Citas day screen (/scheduling/booked) without React: the row of `GET appointments/day`, the query
// the filters send, the status shown, today's grouping and the URL state.
// Specs: docs/specs/citas-day-screen.md (screen), docs/specs/appointment-lifecycle-switch-fe.md §5 (API).
// No imports on purpose: Node runs this file's test on its own.

export type DayKind = "medical" | "service"
export type BookingStatus = "booked" | "confirmed" | "arrived" | "cancelled" | "no_show" | "rescheduled"
export type CareStatus = "waiting" | "triage" | "in_consultation" | "called" | "in_therapy" | "done" | "not_served"
export type ConfirmedVia = "person" | "bridge" | "import"

/** A staff member named on a row; `name` is null when the id is not a staff row (old rows). */
export interface DayPerson {
  id: string
  name: string | null
}

/**
 * One row of `GET /api/v2/appointments/day`. Typed by hand from the backend 4a hand-off (and its DTO,
 * cmr-be `day-list.dto.ts`) because 4a is not deployed yet: replace with the generated type once
 * `npm run gen:api` runs against a backend with 4a.
 */
export interface DayListRow {
  id: string
  kind: DayKind
  patient: { id: string; name: string | null }
  /** "HH:mm", or null for a row with no time (sessions can lack one). */
  time: string | null
  typeLabel: string | null
  isNewPatientType: boolean
  serviceName: string | null
  bookingStatus: BookingStatus | null
  careStatus: CareStatus | null
  createdBy: DayPerson | null
  confirmedAt: string | null
  confirmedBy: DayPerson | null
  confirmedVia: ConfirmedVia | null
  visit: { id: string; arrivedAt: string | null } | null
  centerId: string
  portfolioOwner: DayPerson | null
  allowedActions: string[]
}

// ---- query ----------------------------------------------------------------------------------------

/**
 * The query of `GET /api/v2/appointments/day`, typed by hand (not in schema.d.ts yet). Lists are comma
 * separated. `staffIds` = who CREATED the row ("Booked by"); `portfolioOwnerIds` = the patient's
 * portfolio owner (`booked_by_staff_id`, "Cartera"); both sent = AND. `portfolioOwnerIds` needs the
 * backend cartera PR (feat/day-list-portfolio-filter): before it, `staffIds` also matched the owner.
 */
export interface DayListQuery {
  date: string
  centerIds?: string
  kind?: DayKind
  appointmentTypeIds?: string
  serviceIds?: string
  staffIds?: string
  portfolioOwnerIds?: string
  includeCancelled?: "true"
}

/** "Booked by" and "Cartera": me, everyone, or a staff id. */
export const BOOKED_BY_ME = "me"
export const BOOKED_BY_ALL = "all"

/** Where "booked by" is remembered on this device (per-viewer convenience, never shared state). */
export const BOOKED_BY_STORAGE_KEY = "cmr.appointmentsDay.bookedBy"
/** Where "Cartera" is remembered on this device. */
export const OWNER_STORAGE_KEY = "cmr.appointmentsDay.portfolioOwner"

/** The remembered choice, or the default (Me). Someone with no staff record cannot be "me": All. */
export function bookedByOrDefault(stored: string | null | undefined, myStaffId: string | null | undefined): string {
  const choice = stored || BOOKED_BY_ME
  if (choice === BOOKED_BY_ME && !myStaffId) return BOOKED_BY_ALL
  return choice
}

/**
 * The "booked by" the list is read with, or null while it cannot be told yet (so the screen never reads
 * All first and then flips to Me). `myStaffId`: undefined while `me` loads, null when the person has no
 * staff record. `staffOptions`: the picker's staff ids, null while they load, [] when their request
 * failed. A remembered staff id waits for the options; one that is not among them (gone, or the list
 * failed) falls back to the default (Me, or All without a staff record), so the list always loads.
 */
export function bookedByChoice(
  stored: string | null | undefined,
  myStaffId: string | null | undefined,
  staffOptions: readonly string[] | null,
): string | null {
  if (myStaffId === undefined) return null
  if (stored && stored !== BOOKED_BY_ME && stored !== BOOKED_BY_ALL) {
    if (!staffOptions) return null
    if (!staffOptions.includes(stored)) return bookedByOrDefault(null, myStaffId)
  }
  return bookedByOrDefault(stored, myStaffId)
}

/**
 * The "Cartera" (portfolio owner) the list is read with, or null while it cannot be told yet. The URL
 * (`?owner=`) wins over the device, then the default: All. All never waits; Me waits for `me` and falls
 * back to All without a staff record; a staff id waits for the options and falls back to All when it is
 * not among them (gone, or the staff list failed: []). Same inputs as `bookedByChoice`.
 */
export function ownerChoice(
  fromUrl: string | null | undefined,
  stored: string | null | undefined,
  myStaffId: string | null | undefined,
  staffOptions: readonly string[] | null,
): string | null {
  const choice = fromUrl || stored || BOOKED_BY_ALL
  if (choice === BOOKED_BY_ALL) return BOOKED_BY_ALL
  if (choice === BOOKED_BY_ME) {
    if (myStaffId === undefined) return null
    return myStaffId ? BOOKED_BY_ME : BOOKED_BY_ALL
  }
  if (!staffOptions) return null
  return staffOptions.includes(choice) ? choice : BOOKED_BY_ALL
}

/** The staff id a "me / all / id" choice stands for; null = no filter. */
function staffFor(choice: string | undefined, myStaffId: string | null | undefined): string | null {
  if (!choice || choice === BOOKED_BY_ALL) return null
  return choice === BOOKED_BY_ME ? (myStaffId ?? null) : choice
}

// ---- appointment-type picker ----------------------------------------------------------------------

/** The slug of the new-patient medical type; the backend sets `isNewPatientType` from the same slug. */
export const NEW_PATIENT_TYPE_SLUG = "nueva"

/** One entry of the "Type" picker: a medical appointment type or a therapy service. */
export interface TypeOption {
  id: string
  kind: DayKind
  label: string
  isNewPatientType: boolean
}

/**
 * The picker's entries: the active medical types (`GET appointments/types`), then the center's services
 * (`GET services`, active only by default), each group sorted by name.
 */
export function typeOptions(
  types: readonly { id: string; slug: string; name: string; active?: boolean }[],
  services: readonly { id: string; name: string }[],
): TypeOption[] {
  const byLabel = (a: TypeOption, b: TypeOption) => a.label.localeCompare(b.label)
  const medical = types
    .filter((t) => t.active !== false)
    .map((t) => ({ id: t.id, kind: "medical" as const, label: t.name, isNewPatientType: t.slug === NEW_PATIENT_TYPE_SLUG }))
    .sort(byLabel)
  const service = services
    .map((s) => ({ id: s.id, kind: "service" as const, label: s.name, isNewPatientType: false }))
    .sort(byLabel)
  return [...medical, ...service]
}

/**
 * The picked entries the list is read with, or null while they cannot be told (a pick in the URL and the
 * options still loading: the list waits rather than reading unfiltered first). `options`: null while
 * loading, [] when their request failed (the pick is then dropped so the list always loads). Ids that
 * are not among the options are left out.
 */
export function pickedTypes(picked: readonly string[], options: readonly TypeOption[] | null): TypeOption[] | null {
  if (picked.length === 0) return []
  if (!options) return null
  const ids = new Set(picked)
  return options.filter((o) => ids.has(o.id))
}

/**
 * The query of the day list for the screen's filters. `picked` sends `appointmentTypeIds` and/or
 * `serviceIds`; the backend then leaves out a kind with no list of its own (only services picked = only
 * therapies). `bookedBy` → `staffIds` (creator); `portfolioOwner` → `portfolioOwnerIds`, sent only when it
 * is not All, so the default asks nothing a backend without the cartera PR does not know.
 */
export function dayListQuery(p: {
  date: string
  centerId?: string
  bookedBy: string
  portfolioOwner?: string
  myStaffId: string | null | undefined
  includeCancelled: boolean
  picked?: readonly TypeOption[]
}): DayListQuery {
  const q: DayListQuery = { date: p.date }
  if (p.centerId) q.centerIds = p.centerId
  const typeIds = (p.picked ?? []).filter((o) => o.kind === "medical").map((o) => o.id)
  const serviceIds = (p.picked ?? []).filter((o) => o.kind === "service").map((o) => o.id)
  if (typeIds.length) q.appointmentTypeIds = typeIds.join(",")
  if (serviceIds.length) q.serviceIds = serviceIds.join(",")
  const creator = staffFor(p.bookedBy, p.myStaffId)
  if (creator) q.staffIds = creator
  const owner = staffFor(p.portfolioOwner, p.myStaffId)
  if (owner) q.portfolioOwnerIds = owner
  if (p.includeCancelled) q.includeCancelled = "true"
  return q
}

/** `dayListQuery` as a query string. */
export function dayListSearch(p: Parameters<typeof dayListQuery>[0]): URLSearchParams {
  return new URLSearchParams(Object.entries(dayListQuery(p)) as [string, string][])
}

// ---- status ---------------------------------------------------------------------------------------

export interface RowStatus {
  /** The stage to show (care stage once arrived, else the booking stage); null = not reconciled yet. */
  stage: BookingStatus | CareStatus | null
  /** How a still-confirmed row was confirmed; null when not confirmed or the source cannot be told. */
  confirmation: { via: ConfirmedVia; name: string | null } | null
}

export function rowStatus(row: DayListRow): RowStatus {
  if (row.careStatus) return { stage: row.careStatus, confirmation: null }
  const confirmation =
    row.bookingStatus === "confirmed" && row.confirmedVia
      ? { via: row.confirmedVia, name: row.confirmedVia === "person" ? (row.confirmedBy?.name ?? null) : null }
      : null
  return { stage: row.bookingStatus, confirmation }
}

// ---- today ----------------------------------------------------------------------------------------

/** The day (YYYY-MM-DD) and the minute (HH:mm, 24h) at `now` in an IANA time zone. */
export function nowInZone(now: Date, timeZone: string): { day: string; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${get("hour")}:${get("minute")}` }
}

export type TodayGroup = "arrived" | "late" | "upcoming"

const STILL_BOOKED = new Set<BookingStatus | null>(["booked", "confirmed"])

/**
 * Today's group of a row at the minute `nowHHmm` (center time): arrived (has a visit or a care stage),
 * late (still booked or confirmed and its time has passed), upcoming (time ahead, or no time: a therapy
 * with no time is never late). No-show, cancelled and rescheduled rows are in no group.
 */
export function todayGroup(row: DayListRow, nowHHmm: string): TodayGroup | null {
  if (row.visit || row.careStatus || row.bookingStatus === "arrived") return "arrived"
  if (!STILL_BOOKED.has(row.bookingStatus)) return null
  return row.time !== null && row.time < nowHHmm ? "late" : "upcoming"
}

export function todaySummary(rows: DayListRow[], nowHHmm: string): Record<TodayGroup, number> {
  const out: Record<TodayGroup, number> = { arrived: 0, late: 0, upcoming: 0 }
  for (const r of rows) {
    const g = todayGroup(r, nowHHmm)
    if (g) out[g]++
  }
  return out
}

// ---- KPI cards ----------------------------------------------------------------------------------

export interface DayKpis {
  /** Not cancelled and not rescheduled (no-show and arrived included). */
  booked: number
  /** Of those: confirmed now, or confirmed before arriving (`confirmedAt`). */
  confirmed: number
  /** Of those: booking stage arrived (not served included: it is a care stage on an arrived row). */
  arrived: number
}

const NOT_BOOKED = new Set<BookingStatus | null>(["cancelled", "rescheduled"])

/** The Citados / Confirmados / Presentes counts of the rows on screen (they follow every filter). */
export function dayKpis(rows: readonly DayListRow[]): DayKpis {
  const out: DayKpis = { booked: 0, confirmed: 0, arrived: 0 }
  for (const r of rows) {
    if (NOT_BOOKED.has(r.bookingStatus)) continue
    out.booked++
    if (r.bookingStatus === "confirmed" || r.confirmedAt) out.confirmed++
    if (r.bookingStatus === "arrived") out.arrived++
  }
  return out
}

// ---- URL ------------------------------------------------------------------------------------------

export interface DayScreenParams {
  date: string
  includeCancelled: boolean
  /** Picked appointment-type and service ids (the "Type" picker); [] = no type filter. */
  types: string[]
  /** "Cartera" from the URL (`?owner=`): me, a staff id, or null (not in the URL; the device decides). */
  owner: string | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** `?date=&cancelled=1&types=a,b&owner=`; a missing or malformed day opens on `today`. */
export function parseDayScreenParams(sp: URLSearchParams, today: string): DayScreenParams {
  const date = sp.get("date") ?? ""
  return {
    date: DAY.test(date) ? date : today,
    includeCancelled: sp.get("cancelled") === "1",
    types: [...new Set((sp.get("types") ?? "").split(",").filter(Boolean))],
    owner: sp.get("owner") || null,
  }
}

export function toDayScreenSearch(p: DayScreenParams): string {
  const parts = [`date=${p.date}`]
  if (p.includeCancelled) parts.push("cancelled=1")
  if (p.types.length) parts.push(`types=${p.types.map(encodeURIComponent).join(",")}`)
  if (p.owner && p.owner !== BOOKED_BY_ALL) parts.push(`owner=${encodeURIComponent(p.owner)}`)
  return parts.join("&")
}
