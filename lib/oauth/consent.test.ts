// The Claude connector's consent page (docs/specs/mcp-connector-consent-page.md): what to do with
// Supabase's answer, who may approve, and which host the user goes back to.
import test from "node:test"
import assert from "node:assert/strict"
import { canApprove, consentStep, redirectHost } from "./consent.ts"

test("already approved before → go straight back to the client", () => {
  assert.deepEqual(
    consentStep({
      redirect_url: "https://claude.ai/api/mcp/auth_callback?code=x",
    }),
    {
      kind: "redirect",
      url: "https://claude.ai/api/mcp/auth_callback?code=x",
    }
  )
})

test("needs consent → show the page with client, user and redirect host", () => {
  const details = {
    authorization_id: "a1",
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    client: { id: "c", name: "Claude", uri: "https://claude.ai", logo_uri: "" },
    user: { id: "u", email: "ana@cmr.com" },
    scope: "openid email",
  }
  assert.deepEqual(consentStep(details), { kind: "consent", details })
})

test("anything else (no data) → error", () => {
  assert.deepEqual(consentStep(null), { kind: "error" })
  assert.deepEqual(consentStep({}), { kind: "error" })
})

test("the redirect host is shown, not the full URL", () => {
  assert.equal(
    redirectHost("https://claude.ai/api/mcp/auth_callback"),
    "claude.ai"
  )
  assert.equal(redirectHost("http://localhost:33418/callback"), "localhost")
  assert.equal(redirectHost("not a url"), null)
})

test("only an approved account may approve; pending, rejected and suspended may not", () => {
  assert.equal(canApprove("aprobado"), true)
  for (const s of ["pendiente", "rechazado", "suspendido", null] as const) {
    assert.equal(canApprove(s), false, String(s))
  }
})
