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
