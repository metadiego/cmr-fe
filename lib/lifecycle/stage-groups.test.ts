import { test } from "node:test"
import assert from "node:assert/strict"

import {
  BEFORE_ARRIVAL,
  IN_CARE,
  LIVE,
  CANCELLED,
  CLOSED,
  isCancelledRow,
  MEDICAL_GROUPS,
  NEVER_SEEN,
  NOT_CANCELLED,
  NOT_OCCUPYING_THE_DAY,
  SHOWED_UP,
  SHOWN_IN_LIST,
  THERAPY_GROUPS,
  groupIn,
  groupOf,
  groupsExcept,
  inGroups,
  isNotCancelled,
  rowGroup,
  rowInGroups,
  sessionStageFields,
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
  // No syncedStatus on the row (a board row): the stage columns are trusted while they agree with the
  // old word's group; here they do not (6b review), so the old word decides.
  assert.deepEqual(
    stagesOf("medical", {
      status: "programada",
      bookingStatus: "confirmed",
      careStatus: null,
    }),
    {
      booking: "booked",
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

test("syncedStatus present but null means not synced: derive from the old value; key absent: trust the columns only if they agree", () => {
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
      booking: "arrived",
      care: "waiting",
    }
  )
})

test("no syncedStatus key: stored stages that agree with the old word's group are trusted (they say more)", () => {
  // A called session: the old word says present (waiting), the columns say called (same group).
  assert.deepEqual(stagesOf("therapy", { status: "presente", bookingStatus: "arrived", careStatus: "called" }), {
    booking: "arrived",
    care: "called",
  })
  // A not-served appointment: cancelled and not served share a group.
  assert.deepEqual(stagesOf("medical", { estado: "cancelada", bookingStatus: "arrived", careStatus: "not_served" }), {
    booking: "arrived",
    care: "not_served",
  })
  // No old word at all: the columns are all there is.
  assert.deepEqual(stagesOf("medical", { bookingStatus: "confirmed", careStatus: null }), { booking: "confirmed", care: null })
})

test("no syncedStatus key: stored stages of another group than the old word are stale, the old word decides", () => {
  assert.deepEqual(stagesOf("medical", { estado: "atendida", bookingStatus: "arrived", careStatus: "waiting" }), {
    booking: "arrived",
    care: "done",
  })
  assert.deepEqual(stagesOf("therapy", { status: "asistido", bookingStatus: "arrived", careStatus: "in_therapy" }), {
    booking: "arrived",
    care: "done",
  })
})

test("rowGroup: a row's group, by its stages or derived from its old value; null when unknown", () => {
  assert.equal(rowGroup("therapy", { status: "presente", calledAt: AT }), "waiting")
  assert.equal(rowGroup("therapy", { status: "cancelada", presentAt: AT }), "cancelled_or_not_served")
  assert.equal(rowGroup("therapy", { bookingStatus: "arrived", careStatus: "called" }), "waiting")
  assert.equal(rowGroup("therapy", { status: "otro" }), null)
  assert.equal(rowGroup("medical", { estado: "en_consulta" }), "in_consultation")
  assert.equal(rowGroup("medical", { estado: "cancelada", arrivedAt: AT }), "cancelled_or_not_served")
})

test("groupIn: a stored group against a list of the kind's groups; null is in none; a group of the other kind throws", () => {
  assert.equal(groupIn("therapy", "waiting", ["waiting", "in_therapy"]), true)
  assert.equal(groupIn("therapy", "done", ["waiting"]), false)
  assert.equal(groupIn("therapy", null, ["waiting"]), false)
  assert.equal(groupIn("medical", "in_consultation", IN_CARE.medical), true)
  assert.throws(() => groupIn("therapy", "waiting", ["in_consultation"]), /therapy has no stage group in_consultation/)
  assert.throws(() => groupIn("medical", null, ["upcoming"]), /medical has no stage group upcoming/)
})

test("sessionStageFields: picks the session's stage fields and stamps, nothing else", () => {
  const session = {
    id: "s1",
    status: "presente",
    bookingStatus: "arrived",
    careStatus: "called",
    syncedStatus: "presente",
    confirmedAt: null,
    calledAt: AT,
    presentAt: AT,
    serviceId: "x",
  } as const
  assert.deepEqual(sessionStageFields(session), {
    bookingStatus: "arrived",
    careStatus: "called",
    syncedStatus: "presente",
    confirmedAt: null,
    calledAt: AT,
    presentAt: AT,
  })
  // With the row's status beside it, the picked fields keep the row's group (a called session waits).
  assert.equal(rowGroup("therapy", { status: session.status, ...sessionStageFields(session) }), "waiting")
})

test("NEVER_SEEN: medical rows closed without the patient being seen; not served counts, done does not", () => {
  assert.equal(rowInGroups("medical", { estado: "no_show" }, NEVER_SEEN), true)
  assert.equal(rowInGroups("medical", { estado: "cancelada", arrivedAt: AT }, NEVER_SEEN), true)
  assert.equal(rowInGroups("medical", { estado: "atendida" }, NEVER_SEEN), false)
  assert.equal(rowInGroups("medical", { estado: "presente" }, NEVER_SEEN), false)
})

test("isCancelledRow: cancelled or not served, per kind; unknown status is not cancelled", () => {
  assert.deepEqual([...CANCELLED], ["cancelled_or_not_served"])
  assert.deepEqual([...CLOSED], ["done", "cancelled_or_not_served"])
  assert.equal(isCancelledRow("therapy", { status: "cancelada" }), true)
  assert.equal(isCancelledRow("therapy", { status: "cancelada", presentAt: "2026-11-26T13:00:00Z" }), true)
  assert.equal(isCancelledRow("medical", { estado: "cancelada" }), true)
  assert.equal(isCancelledRow("medical", { estado: "atendida" }), false)
  assert.equal(isCancelledRow("therapy", { status: "raro" }), false)
})
