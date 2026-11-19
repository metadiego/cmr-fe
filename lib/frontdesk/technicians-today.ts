// Who is free / in therapy right now, for the «Técnicos» button of the patient desk.
// Source of truth: `techniciansToday` from GET /frontdesk/queue (BE #499): everyone with a live
// session today, so a technician who finished their patient (asistido) still shows as FREE.
// Until that field arrives, the old derivation: in therapy = inTherapy[]; free = assigned to a
// called patient (waiting[].technicianId) and not in therapy. The service name of a busy technician
// always comes from inTherapy per service.

import type { FrontdeskQueue } from "../api/frontdesk-queue.ts";

export type TechnicianFree = { id: string; name: string };
export type TechnicianBusy = { id: string; name: string; servicio: string };

export function techniciansNow(queue: FrontdeskQueue | null): {
  libres: TechnicianFree[];
  ocupados: TechnicianBusy[];
  /** Everyone active today, id → name (the break picker offers these). */
  activosHoy: Map<string, string>;
} {
  const label = (id: string, name: string | null | undefined) => name ?? id.slice(0, 8);
  const servicioDe = new Map<string, { name: string; servicio: string }>();
  for (const s of queue?.services ?? []) {
    for (const p of s.inTherapy) {
      if (p.technicianId && !servicioDe.has(p.technicianId)) {
        servicioDe.set(p.technicianId, { name: label(p.technicianId, p.technicianName), servicio: s.name });
      }
    }
  }

  const activosHoy = new Map<string, string>();
  const today = queue?.techniciansToday;
  if (Array.isArray(today)) {
    for (const t of today) activosHoy.set(t.staffId, label(t.staffId, t.name));
    const busy = new Set(today.filter((t) => t.inTherapy).map((t) => t.staffId));
    // Someone in inTherapy the roster missed (should not happen) still counts as busy.
    for (const [id, v] of servicioDe) {
      busy.add(id);
      if (!activosHoy.has(id)) activosHoy.set(id, v.name);
    }
    return {
      libres: [...activosHoy].filter(([id]) => !busy.has(id)).map(([id, name]) => ({ id, name })),
      ocupados: [...busy].map((id) => ({ id, name: activosHoy.get(id)!, servicio: servicioDe.get(id)?.servicio ?? "" })),
      activosHoy,
    };
  }

  for (const [id, v] of servicioDe) activosHoy.set(id, v.name);
  for (const s of queue?.services ?? []) {
    for (const w of s.waiting) if (w.technicianId) activosHoy.set(w.technicianId, label(w.technicianId, w.technicianName));
  }
  return {
    libres: [...activosHoy].filter(([id]) => !servicioDe.has(id)).map(([id, name]) => ({ id, name })),
    ocupados: [...servicioDe].map(([id, v]) => ({ id, ...v })),
    activosHoy,
  };
}

// Minutes offered for a break: data on the status type (`durationOptions`, handoff
// docs/specs/break-duration-options-handoff.md), so adding 45/60 needs no code. null, empty or not yet
// served by the BE → the original quick list.
export const DEFAULT_BREAK_MINUTES: readonly number[] = [10, 15, 30];
export function breakMinutes(tipo: object | null | undefined): readonly number[] {
  const raw = (tipo as { durationOptions?: unknown } | null | undefined)?.durationOptions;
  if (!Array.isArray(raw)) return DEFAULT_BREAK_MINUTES;
  const ok = [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  return ok.length ? ok : DEFAULT_BREAK_MINUTES;
}

// How an onShift row reads in the technician picker: available → free; not working here yet today
// (presentToday=false, available=false with load 0) → «sin pacientes hoy», still selectable; otherwise
// busy (load > 0, on a break or shift over). Without presentToday (older BE) → busy, as before.
export type OnShiftState = "free" | "notYetToday" | "busy";
export function onShiftState(o: { available: boolean; presentToday?: boolean }): OnShiftState {
  if (o.available) return "free";
  return o.presentToday === false ? "notYetToday" : "busy";
}
