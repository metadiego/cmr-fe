import { test } from "node:test"
import assert from "node:assert/strict"

import {
  BOOKED_BY_ALL,
  BOOKED_BY_ME,
  bookedByChoice,
  bookedByOrDefault,
  dayListSearch,
  keepByBucket,
  ownerChoice,
  nowInZone,
  parseDayScreenParams,
  rowStatus,
  todayGroup,
  pickedTypes,
  pruneTypes,
  todaySummary,
  toDayScreenSearch,
  typeOptions,
  typeOptionsForBucket,
  type DayListRow,
  type TypeOption,
} from "./day-list.ts"

function row(over: Partial<DayListRow> = {}): DayListRow {
  return {
    id: "r1",
    kind: "medical",
    patient: { id: "p1", name: "Ana Pérez" },
    time: "09:00",
    typeLabel: "Seguimiento",
    isNewPatientType: false,
    serviceName: null,
    bookingStatus: "booked",
    careStatus: null,
    createdBy: { id: "s1", name: "Carla" },
    confirmedAt: null,
    confirmedBy: null,
    confirmedVia: null,
    visit: null,
    centerId: "c1",
    portfolioOwner: null,
    allowedActions: [],
    ...over,
  }
}

// ---- query --------------------------------------------------------------------------------------

test("the query always names the day and the center", () => {
  const sp = dayListSearch({ date: "2026-11-24", centerId: "c1", bucket: "all", bookedBy: BOOKED_BY_ALL, myStaffId: "me1", includeCancelled: false })
  assert.equal(sp.get("date"), "2026-11-24")
  assert.equal(sp.get("centerIds"), "c1")
  assert.equal(sp.has("kind"), false)
  assert.equal(sp.has("staffIds"), false)
  assert.equal(sp.has("includeCancelled"), false)
})

test("type buckets map to the kind (new and follow-up are medical, therapies are sessions)", () => {
  const q = (bucket: "new" | "followUp" | "therapies") =>
    dayListSearch({ date: "2026-11-24", bucket, bookedBy: BOOKED_BY_ALL, myStaffId: null, includeCancelled: false }).get("kind")
  assert.equal(q("new"), "medical")
  assert.equal(q("followUp"), "medical")
  assert.equal(q("therapies"), "service")
})

test("booked by: me sends my staff id, a person sends theirs, all sends none", () => {
  const base = { date: "2026-11-24", bucket: "all" as const, includeCancelled: false }
  assert.equal(dayListSearch({ ...base, bookedBy: BOOKED_BY_ME, myStaffId: "me1" }).get("staffIds"), "me1")
  assert.equal(dayListSearch({ ...base, bookedBy: "s9", myStaffId: "me1" }).get("staffIds"), "s9")
  assert.equal(dayListSearch({ ...base, bookedBy: BOOKED_BY_ALL, myStaffId: "me1" }).has("staffIds"), false)
})

test("cartera: sent as portfolioOwnerIds only when it is not All (me = my staff id); booked by stays creator-only", () => {
  const base = { date: "2026-11-24", bucket: "all" as const, includeCancelled: false, bookedBy: BOOKED_BY_ME, myStaffId: "me1" }
  const none = dayListSearch(base)
  assert.equal(none.has("portfolioOwnerIds"), false)
  assert.equal(dayListSearch({ ...base, portfolioOwner: BOOKED_BY_ALL }).has("portfolioOwnerIds"), false)
  assert.equal(dayListSearch({ ...base, portfolioOwner: BOOKED_BY_ME }).get("portfolioOwnerIds"), "me1")
  const both = dayListSearch({ ...base, portfolioOwner: "s9" })
  assert.equal(both.get("portfolioOwnerIds"), "s9")
  assert.equal(both.get("staffIds"), "me1")
})

test("cartera: the URL wins over the device, then the default (All)", () => {
  assert.equal(ownerChoice(null, null, "me1", ["s1"]), BOOKED_BY_ALL)
  assert.equal(ownerChoice(null, BOOKED_BY_ME, "me1", ["s1"]), BOOKED_BY_ME)
  assert.equal(ownerChoice("s1", BOOKED_BY_ME, "me1", ["s1"]), "s1")
})

test("cartera: All never waits; Me waits for me and needs a staff record; a staff id waits for the options", () => {
  assert.equal(ownerChoice(null, null, undefined, null), BOOKED_BY_ALL)
  assert.equal(ownerChoice(BOOKED_BY_ME, null, undefined, null), null)
  assert.equal(ownerChoice(BOOKED_BY_ME, null, null, null), BOOKED_BY_ALL)
  assert.equal(ownerChoice("s9", null, "me1", null), null)
  assert.equal(ownerChoice("s9", null, "me1", ["s1"]), BOOKED_BY_ALL)
  assert.equal(ownerChoice("s9", null, "me1", []), BOOKED_BY_ALL)
  assert.equal(ownerChoice("s9", null, undefined, ["s9"]), "s9")
})

test("the URL keeps the cartera (?owner=), All is left out", () => {
  const base = { date: "2026-11-24", bucket: "all" as const, includeCancelled: false, types: [] }
  assert.equal(parseDayScreenParams(new URLSearchParams("owner=s9"), "2026-11-25").owner, "s9")
  assert.equal(parseDayScreenParams(new URLSearchParams(""), "2026-11-25").owner, null)
  assert.equal(toDayScreenSearch({ ...base, owner: "s9" }), "date=2026-11-24&owner=s9")
  assert.equal(toDayScreenSearch({ ...base, owner: BOOKED_BY_ALL }), "date=2026-11-24")
  assert.equal(toDayScreenSearch({ ...base, owner: null }), "date=2026-11-24")
})

test("show cancelled asks the backend for cancelled and rescheduled rows", () => {
  const sp = dayListSearch({ date: "2026-11-24", bucket: "all", bookedBy: BOOKED_BY_ALL, myStaffId: null, includeCancelled: true })
  assert.equal(sp.get("includeCancelled"), "true")
})

test("booked by defaults to me, falls back to all for someone with no staff record", () => {
  assert.equal(bookedByOrDefault(null, "me1"), BOOKED_BY_ME)
  assert.equal(bookedByOrDefault("s9", "me1"), "s9")
  assert.equal(bookedByOrDefault(null, null), BOOKED_BY_ALL)
  assert.equal(bookedByOrDefault(BOOKED_BY_ME, null), BOOKED_BY_ALL)
  assert.equal(bookedByOrDefault("", "me1"), BOOKED_BY_ME)
})

// ---- buckets --------------------------------------------------------------------------------------

test("new and follow-up split the medical rows by the new-patient type", () => {
  const rows = [row({ id: "n", isNewPatientType: true }), row({ id: "f" }), row({ id: "s", kind: "service", serviceName: "Laser", typeLabel: null })]
  assert.deepEqual(keepByBucket(rows, "new").map((r) => r.id), ["n"])
  assert.deepEqual(keepByBucket(rows, "followUp").map((r) => r.id), ["f"])
  assert.deepEqual(keepByBucket(rows, "therapies").map((r) => r.id), ["s"])
  assert.deepEqual(keepByBucket(rows, "all").map((r) => r.id), ["n", "f", "s"])
})

// ---- status --------------------------------------------------------------------------------------

test("before arrival the status is the booking stage", () => {
  assert.deepEqual(rowStatus(row()), { stage: "booked", confirmation: null })
})

test("a confirmed row says who confirmed it, or that it came from the call-center sheet", () => {
  const byPerson = rowStatus(row({ bookingStatus: "confirmed", confirmedVia: "person", confirmedBy: { id: "s2", name: "Luis" } }))
  assert.deepEqual(byPerson, { stage: "confirmed", confirmation: { via: "person", name: "Luis" } })
  const bySheet = rowStatus(row({ bookingStatus: "confirmed", confirmedVia: "bridge" }))
  assert.deepEqual(bySheet.confirmation, { via: "bridge", name: null })
  const unknown = rowStatus(row({ bookingStatus: "confirmed", confirmedVia: null }))
  assert.equal(unknown.confirmation, null)
})

test("once arrived the status is the care stage, and arrival never reads as confirmed", () => {
  const r = rowStatus(row({ bookingStatus: "arrived", careStatus: "in_consultation", confirmedVia: "person", confirmedBy: { id: "s2", name: "Luis" } }))
  assert.deepEqual(r, { stage: "in_consultation", confirmation: null })
})

test("a row not yet reconciled has no stage", () => {
  assert.equal(rowStatus(row({ bookingStatus: null })).stage, null)
})

// ---- today ----------------------------------------------------------------------------------------

test("now in a zone: the day and the minute there, not the browser's", () => {
  // 2026-11-25 02:30 UTC is still the 24th at 22:30 in Puerto Rico (UTC-4)
  assert.deepEqual(nowInZone(new Date("2026-11-25T02:30:00Z"), "America/Puerto_Rico"), { day: "2026-11-24", hhmm: "22:30" })
  assert.deepEqual(nowInZone(new Date("2026-11-25T14:05:00Z"), "America/Puerto_Rico"), { day: "2026-11-25", hhmm: "10:05" })
})

test("today groups: arrived (has a visit), late (time passed), upcoming", () => {
  assert.equal(todayGroup(row({ bookingStatus: "arrived", careStatus: "waiting", visit: { id: "v", arrivedAt: null } }), "10:00"), "arrived")
  assert.equal(todayGroup(row({ time: "09:00" }), "10:00"), "late")
  assert.equal(todayGroup(row({ time: "10:00", bookingStatus: "confirmed" }), "10:00"), "upcoming")
  assert.equal(todayGroup(row({ time: "11:30" }), "10:00"), "upcoming")
})

test("a therapy with no time is never late: upcoming until it arrives", () => {
  assert.equal(todayGroup(row({ kind: "service", time: null }), "23:00"), "upcoming")
})

test("no-show and cancelled rows are in no group", () => {
  assert.equal(todayGroup(row({ bookingStatus: "no_show" }), "10:00"), null)
  assert.equal(todayGroup(row({ bookingStatus: "cancelled" }), "10:00"), null)
})

test("the summary counts each group", () => {
  const rows = [
    row({ id: "a", bookingStatus: "arrived", careStatus: "done", visit: { id: "v", arrivedAt: null } }),
    row({ id: "b", time: "08:00" }),
    row({ id: "c", time: "08:30", bookingStatus: "confirmed" }),
    row({ id: "d", time: "12:00" }),
    row({ id: "e", bookingStatus: "no_show" }),
  ]
  assert.deepEqual(todaySummary(rows, "10:00"), { arrived: 1, late: 2, upcoming: 1 })
})

// ---- URL ------------------------------------------------------------------------------------------

test("the URL keeps the day, the type and show-cancelled; a bad day falls back", () => {
  const p = parseDayScreenParams(new URLSearchParams("date=2026-11-24&type=therapies&cancelled=1"), "2026-11-25")
  assert.deepEqual(p, { date: "2026-11-24", bucket: "therapies", includeCancelled: true, types: [], owner: null })
  const bad = parseDayScreenParams(new URLSearchParams("date=24-11&type=nope"), "2026-11-25")
  assert.deepEqual(bad, { date: "2026-11-25", bucket: "all", includeCancelled: false, types: [], owner: null })
  assert.equal(toDayScreenSearch({ date: "2026-11-24", bucket: "all", includeCancelled: false, types: [], owner: null }), "date=2026-11-24")
  assert.equal(
    toDayScreenSearch({ date: "2026-11-24", bucket: "new", includeCancelled: true, types: [], owner: null }),
    "date=2026-11-24&type=new&cancelled=1",
  )
})

test("booked by waits for me: nothing is read (no All first) until the person is known", () => {
  assert.equal(bookedByChoice(null, undefined, []), null)
  assert.equal(bookedByChoice(BOOKED_BY_ME, undefined, ["s1"]), null)
  assert.equal(bookedByChoice(null, "me1", null), BOOKED_BY_ME)
  assert.equal(bookedByChoice(null, null, null), BOOKED_BY_ALL)
  assert.equal(bookedByChoice(BOOKED_BY_ALL, "me1", null), BOOKED_BY_ALL)
})

test("booked by: a remembered staff id waits for the options and falls back to Me when it is gone", () => {
  assert.equal(bookedByChoice("s9", "me1", null), null)
  assert.equal(bookedByChoice("s9", "me1", ["s1", "s9"]), "s9")
  assert.equal(bookedByChoice("s9", "me1", ["s1"]), BOOKED_BY_ME)
  assert.equal(bookedByChoice("s9", null, ["s1"]), BOOKED_BY_ALL)
})

test("booked by: a failed staff list ([]) never blocks the day list; a remembered person falls back", () => {
  assert.equal(bookedByChoice("s9", "me1", []), BOOKED_BY_ME)
  assert.equal(bookedByChoice("s9", null, []), BOOKED_BY_ALL)
  assert.equal(bookedByChoice(BOOKED_BY_ALL, "me1", []), BOOKED_BY_ALL)
})

// ---- appointment-type picker --------------------------------------------------------------------

const TYPES = [
  { id: "tS", slug: "seguimiento", name: "Seguimiento", active: true },
  { id: "tN", slug: "nueva", name: "Consulta (Nueva)", active: true },
  { id: "tOld", slug: "vieja", name: "Vieja", active: false },
]
const SERVICES = [
  { id: "sV", name: "Vitamina C" },
  { id: "sL", name: "Láser" },
]
const OPTIONS: TypeOption[] = typeOptions(TYPES, SERVICES)

test("type options: the active medical types, then the services, each group by name", () => {
  assert.deepEqual(
    OPTIONS.map((o) => [o.kind, o.id, o.label, o.isNewPatientType]),
    [
      ["medical", "tN", "Consulta (Nueva)", true],
      ["medical", "tS", "Seguimiento", false],
      ["service", "sL", "Láser", false],
      ["service", "sV", "Vitamina C", false],
    ],
  )
})

test("type options fit the bucket: new = the 'nueva' type, follow-up = the other medical types, therapies = services", () => {
  const ids = (b: Parameters<typeof typeOptionsForBucket>[1]) => typeOptionsForBucket(OPTIONS, b).map((o) => o.id)
  assert.deepEqual(ids("all"), ["tN", "tS", "sL", "sV"])
  assert.deepEqual(ids("new"), ["tN"])
  assert.deepEqual(ids("followUp"), ["tS"])
  assert.deepEqual(ids("therapies"), ["sL", "sV"])
})

test("changing the bucket drops the picked types that no longer fit; unknown options keep the pick", () => {
  assert.deepEqual(pruneTypes(["tN", "tS", "sL"], OPTIONS, "followUp"), ["tS"])
  assert.deepEqual(pruneTypes(["tN", "sL"], OPTIONS, "therapies"), ["sL"])
  assert.deepEqual(pruneTypes(["tN", "sL"], OPTIONS, "all"), ["tN", "sL"])
  assert.deepEqual(pruneTypes(["tN", "sL"], null, "therapies"), ["tN", "sL"])
})

test("picked types: none picked never waits; a pick waits for the options; a failed list ([]) drops it", () => {
  assert.deepEqual(pickedTypes([], null, "all"), [])
  assert.equal(pickedTypes(["tN"], null, "all"), null)
  assert.deepEqual(pickedTypes(["tN"], [], "all"), [])
  assert.deepEqual(
    pickedTypes(["sL", "gone", "tN"], OPTIONS, "therapies")?.map((o) => o.id),
    ["sL"],
  )
})

test("the query sends the picked medical types and services as comma lists; none picked sends neither", () => {
  const base = { date: "2026-11-24", bucket: "all" as const, bookedBy: BOOKED_BY_ALL, myStaffId: null, includeCancelled: false }
  const none = dayListSearch({ ...base, picked: [] })
  assert.equal(none.has("appointmentTypeIds"), false)
  assert.equal(none.has("serviceIds"), false)
  const onlyServices = dayListSearch({ ...base, picked: pickedTypes(["sL", "sV"], OPTIONS, "all") ?? [] })
  assert.equal(onlyServices.get("serviceIds"), "sL,sV")
  assert.equal(onlyServices.has("appointmentTypeIds"), false)
  const mix = dayListSearch({ ...base, picked: pickedTypes(["tS", "sV"], OPTIONS, "all") ?? [] })
  assert.equal(mix.get("appointmentTypeIds"), "tS")
  assert.equal(mix.get("serviceIds"), "sV")
})

test("the URL keeps the picked types (?types=a,b), deduplicated", () => {
  const p = parseDayScreenParams(new URLSearchParams("date=2026-11-24&types=tS,sV,,tS"), "2026-11-25")
  assert.deepEqual(p.types, ["tS", "sV"])
  assert.equal(
    toDayScreenSearch({ date: "2026-11-24", bucket: "all", includeCancelled: false, types: ["tS", "sV"], owner: null }),
    "date=2026-11-24&types=tS,sV",
  )
})
