// The audit screen tells what a person did in the app from what Claude (an MCP client) did for them
// (cmr-be docs/specs/mcp-connector-claude.md §6b; handoff docs/specs/mcp-connector-consent-page.md §5).
import test from "node:test"
import assert from "node:assert/strict"
import { agentTool, auditVia } from "./via.ts"

test("rows from the MCP door are Claude's; everything else is the app", () => {
  assert.equal(auditVia({ channel: "mcp" }), "claude")
  assert.equal(auditVia({ channel: "rest" }), "app")
})

test("rows from a backend without the column yet count as the app", () => {
  assert.equal(auditVia({}), "app")
  assert.equal(auditVia({ channel: null }), "app")
})

test("the tool is shown only for Claude's rows", () => {
  assert.equal(
    agentTool({ channel: "mcp", tool: "list_invoices" }),
    "list_invoices"
  )
  assert.equal(agentTool({ channel: "rest", tool: "list_invoices" }), null)
  assert.equal(agentTool({ channel: "mcp", tool: null }), null)
})
