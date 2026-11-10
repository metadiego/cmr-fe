// Decisions of the Claude connector's consent page (docs/specs/mcp-connector-consent-page.md),
// kept out of the component so they are tested. Supabase Auth's OAuth server answers
// `getAuthorizationDetails` either with the details to show (the user must consent) or with a
// redirect URL (they already consented to this client).

import type { PerfilEstado } from "../api/auth.ts";

/** The parts of Supabase's `OAuthAuthorizationDetails` the page uses. */
export interface ConsentDetails {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
  scope: string;
}

export type ConsentStep =
  | { kind: "redirect"; url: string }
  | { kind: "consent"; details: ConsentDetails }
  | { kind: "error" };

export function consentStep(data: unknown): ConsentStep {
  if (!data || typeof data !== "object") return { kind: "error" };
  const d = data as Partial<ConsentDetails> & { redirect_url?: unknown };
  if (typeof d.redirect_url === "string" && d.redirect_url) {
    return { kind: "redirect", url: d.redirect_url };
  }
  if (typeof d.authorization_id === "string" && d.authorization_id && d.client && d.user) {
    return { kind: "consent", details: d as ConsentDetails };
  }
  return { kind: "error" };
}

/** The host the user is sent back to (the MCP spec asks to show it), or null if unreadable. */
export function redirectHost(redirectUri: string): string | null {
  try {
    return new URL(redirectUri).hostname || null;
  } catch {
    return null;
  }
}

/** A pending, rejected or suspended account cannot hand its access to Claude. */
export function canApprove(status: PerfilEstado | null): boolean {
  return status === "aprobado";
}
