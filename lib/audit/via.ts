// Which door an audit row came through, for the audit screen. The backend's `channel` is `rest`
// (the app and integrations) or `mcp` (an AI agent such as Claude, through the MCP server). Rows
// served by a backend that does not send it yet count as the app.

export type AuditVia = "app" | "claude"

export function auditVia(row: { channel?: string | null }): AuditVia {
  return row.channel === "mcp" ? "claude" : "app"
}

/** The MCP tool behind a Claude row (what it actually did), or null. */
export function agentTool(row: {
  channel?: string | null
  tool?: string | null
}): string | null {
  return auditVia(row) === "claude" && row.tool ? row.tool : null
}
