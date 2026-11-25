// The Citas day screen (/scheduling/booked) without React: the row of `GET appointments/day`, the query
// the filters send, the type buckets, the status shown, today's grouping and the URL state.
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

export type TypeBucket = "all" | "new" | "followUp" | "therapies"
export const TYPE_BUCKETS: readonly TypeBucket[] = ["all", "new", "followUp", "therapies"]

/** "Booked by": me, everyone, or a staff id. */
export const BOOKED_BY_ME = "me"
export const BOOKED_BY_ALL = "all"

/** Where "booked by" is remembered on this device (per-viewer convenience, never shared state). */
export const BOOKED_BY_STORAGE_KEY = "cmr.appointmentsDay.bookedBy"

/** The remembered choice, or the default (Me). Someone with no staff record cannot be "me": All. */
export function bookedByOrDefault(stored: string | null | undefined, myStaffId: string | null | undefined): string {
  const choice = stored || BOOKED_BY_ME
  if (choice === BOOKED_BY_ME && !myStaffId) return BOOKED_BY_ALL
  return choice
}

/** The query string of the day list for the screen's filters. */
export function dayListSearch(p: {
  date: string
  centerId?: string
  bucket: TypeBucket
  bookedBy: string
  myStaffId: string | null | undefined
  includeCancelled: boolean
}): URLSearchParams {
  const sp = new URLSearchParams({ date: p.date })
  if (p.centerId) sp.set("centerIds", p.centerId)
  if (p.bucket === "new" || p.bucket === "followUp") sp.set("kind", "medical")
  if (p.bucket === "therapies") sp.set("kind", "service")
  const staffId = p.bookedBy === BOOKED_BY_ME ? p.myStaffId : p.bookedBy === BOOKED_BY_ALL ? null : p.bookedBy
  if (staffId) sp.set("staffIds", staffId)
  if (p.includeCancelled) sp.set("includeCancelled", "true")
  return sp
}

/** New / follow-up split the medical rows by the new-patient type; the backend already narrowed the kind. */
export function keepByBucket(rows: DayListRow[], bucket: TypeBucket): DayListRow[] {
  switch (bucket) {
    case "new":
      return rows.filter((r) => r.kind === "medical" && r.isNewPatientType)
    case "followUp":
      return rows.filter((r) => r.kind === "medical" && !r.isNewPatientType)
    case "therapies":
      return rows.filter((r) => r.kind === "service")
    default:
      return rows
  }
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

// ---- URL ------------------------------------------------------------------------------------------

export interface DayScreenParams {
  date: string
  bucket: TypeBucket
  includeCancelled: boolean
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** `?date=&type=&cancelled=1`; a missing or malformed day opens on `today`. */
export function parseDayScreenParams(sp: URLSearchParams, today: string): DayScreenParams {
  const date = sp.get("date") ?? ""
  const type = sp.get("type") as TypeBucket | null
  return {
    date: DAY.test(date) ? date : today,
    bucket: type && TYPE_BUCKETS.includes(type) ? type : "all",
    includeCancelled: sp.get("cancelled") === "1",
  }
}

export function toDayScreenSearch(p: DayScreenParams): string {
  const parts = [`date=${p.date}`]
  if (p.bucket !== "all") parts.push(`type=${p.bucket}`)
  if (p.includeCancelled) parts.push("cancelled=1")
  return parts.join("&")
}
