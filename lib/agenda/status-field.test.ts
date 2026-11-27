import { test } from "node:test"
import assert from "node:assert/strict"

import { colourStatuses, statusBadge, statusOptions } from "./status-field.ts"

// The consultation board's statuses (frontdesk_consultation, production colours), as 6a and 6b serve them.
const C6A = [
  { slug: "programada", color: "#64748b" },
  { slug: "confirmada", color: "#3b82f6" },
  { slug: "presente", color: "#8b5cf6" },
  { slug: "cancelada", color: "#ef4444" },
]
const G: Record<string, string> = { programada: "booked", confirmada: "confirmed", presente: "waiting", cancelada: "cancelled_or_not_served" }
const C6B = C6A.map((s) => ({ ...s, group: G[s.slug] }))

for (const [shape, statuses] of [["6a", C6A], ["6b", C6B]] as const) {
  test(`create toggle (${shape}): booked and confirmed with the catalogue's dots`, () => {
    assert.deepEqual(statusOptions(statuses), [
      { value: "booked", labelKey: "lifecycle.label.medical.booked", dot: "#64748b" },
      { value: "confirmed", labelKey: "lifecycle.label.medical.confirmed", dot: "#3b82f6" },
    ])
  })

  test(`edit badge (${shape}): the stage label in the colour of its group's status`, () => {
    assert.deepEqual(statusBadge(statuses, { status: "presente", bookingStatus: "arrived", careStatus: "waiting" }), {
      labelKey: "lifecycle.label.medical.waiting",
      color: "#8b5cf6",
    })
    // Not served: its own words, the cancelled status's colour.
    assert.deepEqual(statusBadge(statuses, { status: "cancelada", bookingStatus: "arrived", careStatus: "not_served" }), {
      labelKey: "lifecycle.label.medical.not_served",
      color: "#ef4444",
    })
  })

  test(`badge (${shape}): no appointment (create without confirm) reads booked; an unknown status falls back`, () => {
    assert.deepEqual(statusBadge(statuses, null), { labelKey: "lifecycle.label.medical.booked", color: "#64748b" })
    assert.deepEqual(statusBadge(statuses, { status: "inventado" }), { labelKey: null, color: null })
  })
}

test("no catalogue yet: options and badge without colour", () => {
  assert.equal(statusOptions([])[0].dot, undefined)
  assert.equal(statusBadge([], null).color, null)
})

test("colourStatuses: create reads the call center board, edit the consultation board", () => {
  const cc = [{ slug: "programada", color: "#111111" }]
  const consultation = [{ slug: "programada", color: "#222222" }]
  assert.deepEqual(colourStatuses(false, consultation, cc), cc)
  assert.deepEqual(colourStatuses(false, null, cc), cc)
  assert.deepEqual(colourStatuses(true, consultation, cc), consultation)
})

test("colourStatuses: edit falls back to the call center board when the consultation board is missing or empty", () => {
  const cc = [{ slug: "programada", color: "#111111" }]
  assert.deepEqual(colourStatuses(true, null, cc), cc)
  assert.deepEqual(colourStatuses(true, [], cc), cc)
  assert.deepEqual(colourStatuses(true, null, null), [])
  assert.deepEqual(colourStatuses(false, null, null), [])
})
