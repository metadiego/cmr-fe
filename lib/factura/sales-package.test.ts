import { test } from "node:test"
import assert from "node:assert/strict"
import { invoiceSavings, isPackageLine, packageEvidence, savingsPct } from "./sales-package.ts"

// The REAL line the BE returned when selling «Láser IV · 12 terapias» (handoff, 14-oct-2026).
const line = {
  id: "e319fc88",
  quantity: 12,
  unitPrice: 180,
  discount: 720,
  total: 1440,
  salesPackageId: "6d82346f",
  meta: {
    salesPackage: {
      id: "6d82346f",
      name: "Láser IV · 12 terapias",
      sessions: 12,
      regularUnitPrice: 180,
      regularPrice: 2160,
      packagePrice: 1440,
      savings: 720,
    },
  },
}

test("the evidence is the BE's frozen numbers, untouched", () => {
  const e = packageEvidence(line)!
  assert.equal(e.name, "Láser IV · 12 terapias")
  assert.deepEqual([e.regularPrice, e.savings, e.packagePrice], [2160, 720, 1440])
  assert.equal(savingsPct(e), 33)
})

test("a package line is locked; a normal one is not", () => {
  assert.equal(isPackageLine(line), true)
  assert.equal(isPackageLine({ salesPackageId: null }), false)
})

test("«Usted ahorró» sums the package lines' savings, without float drift", () => {
  const other = { ...line, meta: { salesPackage: { ...line.meta.salesPackage, savings: 0.1 } } }
  assert.equal(invoiceSavings([line, other, { salesPackageId: null, meta: null }]), 720.1)
})

test("an invoice without packages changes nothing: no evidence, 0 saved", () => {
  const plain = { salesPackageId: null, meta: { otherThing: 1 } }
  assert.equal(packageEvidence(plain), null)
  assert.equal(invoiceSavings([plain]), 0)
})
