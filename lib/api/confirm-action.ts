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

// «El cuadre de un día pasado no se toca sin autorización» (BE PR #582-583, owner 13-nov-2026, handoff
// .personal/handoff-bloqueo-dias-pasados.md): its own guard, not the generic one above, because it
// needs a REASON the person types (sent as `X-Change-Reason`, not just a yes/no), and that reason can
// be demanded TWICE in the same write — first a plain 400 (no reason at all yet), then the usual 428
// once one is attached. Both land here so every write (void/repair pago, reabrir, cambiar paciente,
// anular factura, editar, y lo mismo en devoluciones) gets this for free, with zero changes at the
// call site — exactly like the shield above.
export const PAST_DAY_ACTION = "cash.past_day.modify";
export const CHANGE_REASON_HEADER = "X-Change-Reason";

export interface PastDaySignature {
  role: string;
  name: string;
  signedAt: string;
}
export interface PastDayDelta {
  method: string | null; // null = ventas/total, no una forma puntual
  amount: number; // negativo = sale del día
}
export interface PastDayModifyRequest {
  day: string;
  action?: string; // payment.void, invoice.reopen, refund.edit, …
  signed?: boolean;
  signatures?: PastDaySignature[];
  delta?: PastDayDelta[];
  /** Precargado si ya se había pedido el motivo en un paso anterior del mismo reintento. */
  reason?: string;
  /** Mismas claves que el shield genérico — `confirmation.action.modifyPastCashDay` / effects. */
  actionLabelKey?: string | null;
  effects?: string[];
}

/** The 400 body's `error` from a write with NO reason attached yet; null otherwise. */
export function readPastDayReasonRequired(status: number, error: unknown): { day: string } | null {
  if (status !== 400) return null;
  const e = (error ?? {}) as Record<string, unknown>;
  if (e.code !== "CASH_PAST_DAY_REASON_REQUIRED") return null;
  return { day: typeof e.day === "string" ? e.day : "" };
}

/** The 428 body's `error` when the pending action is specifically the past-day one. */
export function readPastDayConfirmation(status: number, error: unknown): PastDayModifyRequest | null {
  if (status !== 428) return null;
  const e = (error ?? {}) as Record<string, unknown>;
  if (e.code !== "ACTION_REQUIRES_CONFIRMATION" || e.action !== PAST_DAY_ACTION) return null;
  const p = (e.params && typeof e.params === "object" ? e.params : {}) as Record<string, unknown>;
  return {
    day: typeof p.day === "string" ? p.day : "",
    action: typeof p.action === "string" ? p.action : undefined,
    signed: typeof p.signed === "boolean" ? p.signed : undefined,
    signatures: Array.isArray(p.signatures) ? (p.signatures as PastDaySignature[]) : undefined,
    delta: Array.isArray(p.delta) ? (p.delta as PastDayDelta[]) : undefined,
    actionLabelKey: typeof e.actionLabelKey === "string" ? e.actionLabelKey : null,
    effects: Array.isArray(e.effects) ? e.effects.filter((x): x is string => typeof x === "string") : [],
  };
}

type PastDayHandler = (req: PastDayModifyRequest) => Promise<{ reason: string } | null>;
let pastDayHandler: PastDayHandler | null = null;

/** The dialog host registers itself; returns the unregister. */
export function setPastDayHandler(h: PastDayHandler): () => void {
  pastDayHandler = h;
  return () => {
    if (pastDayHandler === h) pastDayHandler = null;
  };
}

/** Ask for the reason (and show day/signatures/delta when known). null = cancelled or no dialog mounted. */
export function askPastDayReason(req: PastDayModifyRequest): Promise<{ reason: string } | null> {
  return pastDayHandler ? pastDayHandler(req) : Promise.resolve(null);
}

// After a successful write that turned out to touch a past, already-signed day (`meta.advertencias`
// CASH_PAST_DAY_CHANGED): a quiet toast, not a dialog — nothing to decide, just something to know.
type PastDayChangedHandler = (w: { labelKey?: string; day?: string; action?: string }) => void;
let pastDayChangedHandler: PastDayChangedHandler | null = null;
export function setPastDayChangedHandler(h: PastDayChangedHandler): () => void {
  pastDayChangedHandler = h;
  return () => {
    if (pastDayChangedHandler === h) pastDayChangedHandler = null;
  };
}
export function notifyPastDayChanged(w: { labelKey?: string; day?: string; action?: string }): void {
  pastDayChangedHandler?.(w);
}
