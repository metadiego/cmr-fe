import { test } from "node:test"
import assert from "node:assert/strict"

import { ApiError } from "../api/types.ts"
import {
  explainFormatWriteError,
  FORMAT_NEEDS_EVERY_CENTER,
} from "./format-write-error.ts"

test("explainFormatWriteError: a bare 403 gets the every-center label, keeping its body", () => {
  const e = new ApiError("FORBIDDEN", "Forbidden", 403, undefined, undefined, {
    faltan: ["formats.config"],
  })
  const out = explainFormatWriteError(e) as ApiError
  assert.equal(out.labelKey, FORMAT_NEEDS_EVERY_CENTER)
  assert.equal(out.status, 403)
  assert.deepEqual(out.data, { faltan: ["formats.config"] })
})

test("explainFormatWriteError: other errors, and a 403 that already has its label, pass untouched", () => {
  const labelled = new ApiError(
    "FORBIDDEN",
    "x",
    403,
    undefined,
    "errors.other"
  )
  assert.equal(explainFormatWriteError(labelled), labelled)
  const conflict = new ApiError("CONFLICT", "x", 409)
  assert.equal(explainFormatWriteError(conflict), conflict)
  const plain = new Error("network")
  assert.equal(explainFormatWriteError(plain), plain)
})
