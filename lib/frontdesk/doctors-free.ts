// Which doctors are FREE right now (no patient in consultation), from today's "atencion" board rows —
// the same board that already drives the Consulta tab. Pure, so it is tested. Handoff: the owner asked
// "los médicos que están sin pacientes, libres para recibir pacientes" next to the live-location widget.

import type { CitaFila } from "../api/agenda-dia.ts"
import { text } from "./patient-day.ts"

export interface DoctorStatus {
  id: string
  name: string
  free: boolean
}

// Only doctors with at least one row TODAY are reported — an unscheduled doctor is unknown, not free.
// `free` = none of their rows today is actively `en_consulta` (with a patient right now) AND they are
// not on an active vacation/leave covering today (`absentIds` — owner, 06-nov-2026: a doctor on
// vacation must never show as free just because nothing is booked under them).
export function doctorsStatus(
  rows: CitaFila[],
  absentIds: ReadonlySet<string> = new Set(),
): DoctorStatus[] {
  const byId = new Map<string, { name: string; busy: boolean }>()
  for (const r of rows) {
    const id = text(r.medico__valor)
    if (!id) continue
    const name = text(r.medico)
    const cur = byId.get(id) ?? { name: "", busy: false }
    if (!cur.name && name) cur.name = name
    if (r.estado === "en_consulta") cur.busy = true
    byId.set(id, cur)
  }
  return [...byId.entries()]
    .map(([id, v]) => ({ id, name: v.name || id, free: !v.busy && !absentIds.has(id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function freeDoctors(rows: CitaFila[], absentIds: ReadonlySet<string> = new Set()): DoctorStatus[] {
  return doctorsStatus(rows, absentIds).filter((d) => d.free)
}
