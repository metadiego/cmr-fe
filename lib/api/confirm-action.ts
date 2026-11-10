// The safety shield (BE #529, docs/specs/registro-de-cambios-y-confirmacion-handoff.md): a guarded write
// answers HTTP 428 ACTION_REQUIRES_CONFIRMATION; the client asks the person and, on «Aceptar», repeats the
// SAME request with `X-Confirm-Action: <action>`. One piece for every screen and every executor — the
// board engine's /board/action included. This module is the bridge between the client (no React) and the
// dialog mounted once in the app shell (components/confirm-action-host.tsx).

export const CONFIRM_HEADER = "X-Confirm-Action";
/** Thrown when the person answers «Cancelar»: nothing was written; screens stay quiet about it. */
export const CONFIRMATION_DECLINED = "CONFIRMATION_DECLINED";

export interface ConfirmRequest {
  action: string;
  actionLabelKey: string | null;
  effects: string[];
  params: Record<string, unknown>;
}

/** The 428 body's `error`, read defensively; null when it is not the shield's 428. */
export function readConfirmation(status: number, error: unknown): ConfirmRequest | null {
  if (status !== 428) return null;
  const e = (error ?? {}) as Record<string, unknown>;
  if (e.code !== "ACTION_REQUIRES_CONFIRMATION" || typeof e.action !== "string" || !e.action) return null;
  return {
    action: e.action,
    actionLabelKey: typeof e.actionLabelKey === "string" ? e.actionLabelKey : null,
    effects: Array.isArray(e.effects) ? e.effects.filter((x): x is string => typeof x === "string") : [],
    params: e.params && typeof e.params === "object" ? (e.params as Record<string, unknown>) : {},
  };
}

type Handler = (req: ConfirmRequest) => Promise<boolean>;
let handler: Handler | null = null;

/** The dialog host registers itself; returns the unregister. */
export function setConfirmHandler(h: Handler): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

/** Ask the person. No dialog mounted (e.g. a script) → not confirmed, never a silent yes. */
export function askConfirmation(req: ConfirmRequest): Promise<boolean> {
  return handler ? handler(req) : Promise.resolve(false);
}
