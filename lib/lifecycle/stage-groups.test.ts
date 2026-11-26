import { test } from "node:test"
import assert from "node:assert/strict"

import {
  BEFORE_ARRIVAL,
  IN_CARE,
  LIVE,
  MEDICAL_GROUPS,
  NOT_CANCELLED,
  NOT_OCCUPYING_THE_DAY,
  SHOWED_UP,
  SHOWN_IN_LIST,
  THERAPY_GROUPS,
  groupOf,
  groupsExcept,
  inGroups,
  isNotCancelled,
  rowInGroups,
  stagesInGroup,
  stagesOf,
  type AppointmentKind,
  type StageGroup,
  type Stages,
} from "./stage-groups.ts"

const KINDS: AppointmentKind[] = ["medical", "therapy"]
const GROUPS_OF = { medical: MEDICAL_GROUPS, therapy: THERAPY_GROUPS }

// Written out on purpose: the table is checked against literals, not against itself.
const GROUP_OF_OLD_VALUE: Record<
  AppointmentKind,
  Record<string, StageGroup>
> = {
  medical: {
    programada: "booked",
    confirmada: "confirmed",
    presente: "waiting",
    triage: "triage",
    en_consulta: "in_consultation",
    atendida: "done",
    no_show: "no_show",
    cancelada: "cancelled_or_not_served",
    reprogramada: "rescheduled",
  },
  therapy: {
    pendiente: "upcoming",
    presente: "waiting",
    en_terapia: "in_therapy",
    asistido: "done",
    cancelada: "cancelled_or_not_served",
  },
}

const AT = "2026-10-01T10:00:00Z"
const key = (s: Stages) => `${s.booking}/${s.care ?? "-"}`
const backToOld = (kind: AppointmentKind, groups: readonly StageGroup[]) =>
  Object.entries(GROUP_OF_OLD_VALUE[kind])
    .filter(([, g]) => groups.includes(g))
    .map(([old]) => old)
    .sort()

test("each old value derives to exactly the group of the table, for every stamp combination", () => {
  for (const kind of KINDS)
    for (const [status, group] of Object.entries(GROUP_OF_OLD_VALUE[kind]))
      for (const confirmedAt of [null, AT])
        for (const calledAt of [null, AT])
          for (const arrival of [null, AT]) {
            const row =
              kind === "medical"
                ? { estado: status, confirmedAt, arrivedAt: arrival }
                : { status, confirmedAt, calledAt, presentAt: arrival }
            const stages = stagesOf(kind, row)
            assert.notEqual(stages, null, `${kind} ${status}`)
            assert.equal(groupOf(kind, stages!), group, `${kind} ${status}`)
          }
})

test("stagesInGroup covers each group's stages, disjoint, and nothing else", () => {
  for (const kind of KINDS) {
    const keys = GROUPS_OF[kind].flatMap((g) => stagesInGroup(kind, g).map(key))
    assert.equal(new Set(keys).size, keys.length)
    assert.deepEqual(
      [...GROUPS_OF[kind]].sort(),
      [...new Set(Object.values(GROUP_OF_OLD_VALUE[kind]))].sort()
    )
  }
  assert.equal(MEDICAL_GROUPS.length, 9)
  assert.equal(THERAPY_GROUPS.length, 5)
})

test("LIVE, IN_CARE, SHOWED_UP, BEFORE_ARRIVAL are the named unions", () => {
  assert.deepEqual(backToOld("medical", LIVE.medical), [
    "confirmada",
    "en_consulta",
    "presente",
    "programada",
    "triage",
  ])
  assert.deepEqual(backToOld("therapy", LIVE.therapy), [
    "en_terapia",
    "pendiente",
    "presente",
  ])
  assert.deepEqual(
    [...IN_CARE.medical],
    ["waiting", "triage", "in_consultation"]
  )
  assert.deepEqual([...IN_CARE.therapy], ["waiting", "in_therapy"])
  for (const kind of KINDS)
    assert.deepEqual([...SHOWED_UP[kind]], [...IN_CARE[kind], "done"])
  assert.deepEqual([...BEFORE_ARRIVAL.medical], ["booked", "confirmed"])
  assert.deepEqual([...BEFORE_ARRIVAL.therapy], ["upcoming"])
})

test("NOT_OCCUPYING_THE_DAY is no_show, cancelada, reprogramada (done takes the day)", () => {
  assert.deepEqual(backToOld("medical", NOT_OCCUPYING_THE_DAY), [
    "cancelada",
    "no_show",
    "reprogramada",
  ])
  assert.ok(!NOT_OCCUPYING_THE_DAY.includes("done"))
})

test("SHOWN_IN_LIST and NOT_CANCELLED", () => {
  assert.deepEqual(
    backToOld("medical", SHOWN_IN_LIST.medical),
    Object.keys(GROUP_OF_OLD_VALUE.medical)
      .filter((o) => o !== "reprogramada")
      .sort()
  )
  assert.deepEqual(
    backToOld("therapy", SHOWN_IN_LIST.therapy),
    Object.keys(GROUP_OF_OLD_VALUE.therapy).sort()
  )
  assert.deepEqual(backToOld("therapy", NOT_CANCELLED.therapy), [
    "asistido",
    "en_terapia",
    "pendiente",
    "presente",
  ])
  assert.deepEqual(backToOld("medical", NOT_CANCELLED.medical), [
    "atendida",
    "confirmada",
    "en_consulta",
    "no_show",
    "presente",
    "programada",
    "triage",
  ])
})

test("not served is never done, waiting or live; therapy called is waiting", () => {
  const notServed: Stages = { booking: "arrived", care: "not_served" }
  for (const kind of KINDS) {
    assert.equal(groupOf(kind, notServed), "cancelled_or_not_served")
    assert.equal(inGroups(kind, notServed, ["done", "waiting"]), false)
    assert.equal(inGroups(kind, notServed, LIVE[kind]), false)
  }
  const called: Stages = { booking: "arrived", care: "called" }
  assert.equal(groupOf("therapy", called), "waiting")
  assert.equal(inGroups("therapy", called, LIVE.therapy), true)
})

test("inGroups is false without stages; a group or stage of the other kind throws", () => {
  assert.equal(inGroups("medical", null, MEDICAL_GROUPS), false)
  assert.throws(() => stagesInGroup("therapy", "triage"))
  assert.throws(() => stagesInGroup("medical", "upcoming"))
  assert.throws(() => groupOf("therapy", { booking: "no_show", care: null }))
  assert.throws(() =>
    inGroups("medical", { booking: "booked", care: null }, ["in_therapy"])
  )
  assert.throws(() => groupsExcept("therapy", ["triage"]))
})

test("groupsExcept is the kind's groups minus the given ones, in table order", () => {
  assert.deepEqual(
    groupsExcept("medical", ["rescheduled"]),
    MEDICAL_GROUPS.filter((g) => g !== "rescheduled")
  )
  assert.deepEqual(groupsExcept("therapy", []), [...THERAPY_GROUPS])
})

test("stagesOf trusts the stage columns when the row is synced", () => {
  const row = {
    estado: "programada",
    bookingStatus: "booked",
    careStatus: null,
    syncedStatus: "programada",
  } as const
  assert.deepEqual(stagesOf("medical", row), { booking: "booked", care: null })
  // No syncedStatus on the row: the stage columns are trusted as they are.
  assert.deepEqual(
    stagesOf("medical", {
      status: "programada",
      bookingStatus: "confirmed",
      careStatus: null,
    }),
    {
      booking: "confirmed",
      care: null,
    }
  )
})

test("stagesOf derives from the old value when the row is stale or has no stage yet", () => {
  // syncedStatus differs from the old status: the stage columns are stale.
  assert.deepEqual(
    stagesOf("medical", {
      estado: "presente",
      bookingStatus: "booked",
      careStatus: null,
      syncedStatus: "programada",
    }),
    { booking: "arrived", care: "waiting" }
  )
  // No stage yet.
  assert.deepEqual(
    stagesOf("medical", {
      estado: "atendida",
      bookingStatus: null,
      careStatus: null,
    }),
    {
      booking: "arrived",
      care: "done",
    }
  )
  assert.deepEqual(stagesOf("therapy", { status: "pendiente" }), {
    booking: "booked",
    care: null,
  })
  assert.deepEqual(
    stagesOf("therapy", { status: "pendiente", confirmedAt: AT }),
    { booking: "confirmed", care: null }
  )
  assert.deepEqual(stagesOf("therapy", { status: "presente", calledAt: AT }), {
    booking: "arrived",
    care: "called",
  })
  assert.deepEqual(
    stagesOf("therapy", { status: "cancelada", presentAt: AT }),
    { booking: "arrived", care: "not_served" }
  )
  assert.deepEqual(
    stagesOf("medical", { estado: "cancelada", arrivedAt: AT }),
    { booking: "arrived", care: "not_served" }
  )
})

test("a status the mapping does not know has no stages and counts as not cancelled", () => {
  assert.equal(stagesOf("medical", { estado: "asistido" }), null)
  assert.equal(stagesOf("medical", { estado: "toString" }), null)
  assert.equal(stagesOf("therapy", { status: "atendida" }), null)
  assert.equal(stagesOf("medical", {}), null)
  assert.equal(rowInGroups("medical", { estado: "zzz" }, MEDICAL_GROUPS), false)
  assert.equal(isNotCancelled("medical", { estado: "zzz" }), true)
  assert.equal(isNotCancelled("medical", {}), true)
})

test("rowInGroups / isNotCancelled", () => {
  const done = {
    estado: "atendida",
    bookingStatus: "arrived",
    careStatus: "done",
    syncedStatus: "atendida",
  } as const
  assert.equal(rowInGroups("medical", done, SHOWED_UP.medical), true)
  assert.equal(rowInGroups("medical", done, ["booked"]), false)
  assert.equal(isNotCancelled("medical", { estado: "cancelada" }), false)
  assert.equal(isNotCancelled("medical", { estado: "reprogramada" }), true)
  assert.equal(
    isNotCancelled("medical", { estado: "reprogramada" }, ["rescheduled"]),
    false
  )
  assert.equal(
    isNotCancelled("therapy", { status: "cancelada", presentAt: AT }),
    false
  )
  assert.equal(isNotCancelled("therapy", { status: "asistido" }), true)
})

test("syncedStatus present but null means not synced: derive from the old value; key absent: trust the columns", () => {
  assert.deepEqual(
    stagesOf("medical", {
      estado: "presente",
      bookingStatus: "booked",
      careStatus: null,
      syncedStatus: null,
    }),
    { booking: "arrived", care: "waiting" }
  )
  assert.deepEqual(
    stagesOf("medical", {
      estado: "presente",
      bookingStatus: "booked",
      careStatus: null,
    }),
    {
      booking: "booked",
      care: null,
    }
  )
})
