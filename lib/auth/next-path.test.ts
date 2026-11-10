// After signing in, the user goes back to where they were going (the Claude connector's consent
// page carries an authorization_id that must survive the login). Only a path INSIDE the app is
// accepted, so `?next=` can never turn the login into an open redirector.
import test from "node:test"
import assert from "node:assert/strict"
import { safeNextPath } from "./next-path.ts"

test("keeps an in-app path with its query", () => {
  assert.equal(
    safeNextPath("/oauth/consent?authorization_id=abc-123"),
    "/oauth/consent?authorization_id=abc-123"
  )
  assert.equal(safeNextPath("/billing/invoices/42"), "/billing/invoices/42")
})

test("nothing given → null (the caller goes home)", () => {
  assert.equal(safeNextPath(null), null)
  assert.equal(safeNextPath(undefined), null)
  assert.equal(safeNextPath(""), null)
})

test("refuses anything that leaves the app", () => {
  for (const bad of [
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/%2F%2Fevil.example",
    " /dashboard",
    "/\n/evil.example",
  ]) {
    assert.equal(safeNextPath(bad), null, bad)
  }
})

test("never loops back to the login itself", () => {
  assert.equal(safeNextPath("/login"), null)
  assert.equal(safeNextPath("/login?next=/x"), null)
})
