import { test } from "node:test"
import assert from "node:assert/strict"

import { doorSlugOptions } from "./column-pickers.ts"

test("doorSlugOptions: door slugs once each, from either transition shape", () => {
  const a = doorSlugOptions([
    { slug: "presente", fromStatuses: ["programada"], toStatus: "presente" },
    { slug: "cancelar", fromStatuses: [], toStatus: "cancelada" },
    { slug: "presente", fromStatuses: ["confirmada"], toStatus: "presente" },
  ])
  const b = doorSlugOptions([
    { slug: "presente", fromGroups: ["booked"], toGroup: "waiting" },
    { slug: "cancelar", fromGroups: [], toGroup: "cancelled_or_not_served" },
  ])
  assert.deepEqual(a, b)
  assert.deepEqual(a.map((o) => o.value), ["presente", "cancelar"])
})
