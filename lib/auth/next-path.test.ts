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

test("refuses dot segments that the URL parser collapses into a protocol-relative `//host`", () => {
  // new URL("/.//evil.example", base).pathname is "//evil.example": followed by the proxy's
  // new URL(next, request.url) or by redirect(), that is https://evil.example.
  for (const bad of [
    "/.//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "/x/%2e%2e//evil.example",
    "/./\\evil.example",
  ]) {
    assert.equal(safeNextPath(bad), null, bad)
  }
})

test("whatever it returns is a single-slash, same-origin path", () => {
  for (const raw of ["/a/./b", "/a/../b?x=1", "/oauth/consent?authorization_id=x"]) {
    const out = safeNextPath(raw)
    assert.ok(out && out.startsWith("/") && !out.startsWith("//"), raw)
    assert.equal(new URL(out, "https://cmr.example").origin, "https://cmr.example", raw)
  }
})
