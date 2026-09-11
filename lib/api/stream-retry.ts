// What a failed SSE handshake means for a reconnect loop.
//
// Both stream loops (hooks/use-cita-stream.ts and components/comunicaciones/
// alertas-bell.tsx) used to break on 401/403 and reconnect with backoff on
// anything else. Since the backend scopes every realtime stream to the active
// center, a principal without one gets 409 (AuthGuard) or 400 TENANT_REQUIRED —
// and "anything else" reconnected for ever. That is exactly the failure the
// 401/403 stop was added for. See docs/specs/be-sse-acotado-al-centro-handoff.md.

export interface StreamFailure {
  /** Reconnecting can actually fix it: transport drops, 5xx, timeouts, throttling. */
  retryable: boolean;
  /** The backend refuses the stream until the viewer picks an active center. */
  needsCenter: boolean;
}

/** Statuses a retry can still resolve; every other 4xx is the client's own fault. */
const RETRYABLE_CLIENT_STATUS = new Set([408, 429]);

export function classifyStreamFailure(status?: number, code?: string): StreamFailure {
  return {
    retryable:
      status === undefined || status >= 500 || RETRYABLE_CLIENT_STATUS.has(status),
    needsCenter: code === "TENANT_REQUIRED" || status === 409,
  };
}

/** A failed SSE handshake, carrying what `classifyStreamFailure` needs to judge it. */
export interface StreamHandshakeError extends Error {
  status: number;
  code?: string;
}

/**
 * Builds the error a stream client throws when the handshake fails. It reads the
 * backend's `{ error: { code, message } }` envelope so the loop can tell "pick a
 * center" (TENANT_REQUIRED) from "the gateway blipped". A stream response may
 * carry no body at all, so parsing never throws.
 */
export async function streamError(res: Response): Promise<StreamHandshakeError> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const body: unknown = await res.json();
    const error = (body as { error?: { code?: string; message?: string } })?.error;
    code = error?.code;
    message = error?.message;
  } catch {
    /* not the JSON envelope (proxy HTML, empty body): the status is enough */
  }
  const err = new Error(message ?? `stream ${res.status}`) as StreamHandshakeError;
  err.status = res.status;
  err.code = code;
  return err;
}
