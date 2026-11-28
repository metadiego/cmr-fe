import type { Sesion } from "../api/frontdesk.ts"
import { LIVE, rowInGroups } from "../lifecycle/stage-groups.ts"

// The explicit compradas/usadas/agendadas/por-agendar breakdown (handoff saldo-al-citar-explicito,
// 28-nov-2026): a same-day visit a purchase auto-marked present is booked, not used — only an
// attended session counts as used. "Vivas" = from today on, in a LIVE group (never done, never
// cancelled) — read through the stage groups, not the old status words.
export function bookedCount(sessions: Sesion[], today: string): number {
  return sessions.filter((s) => s.date >= today && rowInGroups("therapy", s, LIVE.therapy)).length
}

// Por agendar: lo pendiente menos lo ya agendado, nunca negativo.
export function toBookCount(pending: number, booked: number): number {
  return Math.max(0, pending - booked)
}
