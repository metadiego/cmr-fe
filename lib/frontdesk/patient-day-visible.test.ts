import { test } from "node:test"
import assert from "node:assert/strict"

import { visibleSections, type PatientSection } from "./patient-day.ts"

const svc = (serviceId: string) => ({ kind: "service", service: { serviceId } }) as unknown as PatientSection
const sections: PatientSection[] = [svc("laser"), svc("vitc"), svc("pemf"), { kind: "consultation" } as PatientSection]

test("Vitamina C filter: only Vit C shows, 3 held back", () => {
  const r = visibleSections(sections, "vitc", false)
  assert.equal(r.sections.length, 1)
  assert.equal(r.hidden, 3)
})

test("«ver todas» and no filter: every section, unchanged order", () => {
  assert.equal(visibleSections(sections, "vitc", true).sections, sections)
  assert.equal(visibleSections(sections, null, false).sections, sections)
})

test("a patient without the filtered service keeps all (never an empty panel)", () => {
  assert.deepEqual(visibleSections(sections, "emtt", false), { sections, hidden: 0 })
})
