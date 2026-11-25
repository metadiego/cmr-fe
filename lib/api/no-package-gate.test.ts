import { test } from "node:test"
import assert from "node:assert/strict"
import { noPackageToAttendOf } from "./no-package-gate.ts"
import { ApiError } from "./types.ts"

test("NO_PACKAGE_TO_ATTEND with service and packages: returns them", () => {
  const err = new ApiError(
    "NO_PACKAGE_TO_ATTEND",
    "sin sesiones",
    422,
    undefined,
    "frontdesk.error.no_package_to_attend",
    { service: "NANO", packagesWithoutBalance: ["pkg-1", "pkg-2"] },
  )
  assert.deepEqual(noPackageToAttendOf(err), { service: "NANO", packagesWithoutBalance: ["pkg-1", "pkg-2"] })
})

test("NO_PACKAGE_TO_ATTEND without those fields: null service, empty list — never a crash", () => {
  const err = new ApiError("NO_PACKAGE_TO_ATTEND", "sin sesiones", 422)
  assert.deepEqual(noPackageToAttendOf(err), { service: null, packagesWithoutBalance: [] })
})

test("a different ApiError code: null — this is not the package gate", () => {
  const err = new ApiError("OTRO_CODIGO", "algo más", 422, undefined, undefined, { service: "NANO" })
  assert.equal(noPackageToAttendOf(err), null)
})

test("a non-ApiError value (network failure, plain Error): null, never throws", () => {
  assert.equal(noPackageToAttendOf(new Error("network down")), null)
  assert.equal(noPackageToAttendOf("boom"), null)
  assert.equal(noPackageToAttendOf(null), null)
  assert.equal(noPackageToAttendOf(undefined), null)
})
