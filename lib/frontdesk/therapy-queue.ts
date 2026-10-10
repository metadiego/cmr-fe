// Derivados puros de la cola por terapia (GET /frontdesk/queue, HANDOFF-cola-por-terapia.md). Separado
// de patient-day.ts a propósito (acuerdo con BE 10-oct-2026): función nueva con sus pruebas, en vez de
// reescribir `sortPatients` en el mismo sitio — se integra ahí cuando el endpoint esté desplegado.

import type {
  FrontdeskQueue,
  QueueInTherapyEntry,
  QueueWaitingEntry,
} from "@/lib/api/frontdesk-queue";

// El BE manda el nombre "Apellidos, Nombre" anidado en `patient.name` (verificado por HTTP para
// `waiting`); si no viene (p. ej. `inTherapy`, sin confirmar todavía), cae al `patientName` plano.
export function queueEntryDisplayName(e: QueueWaitingEntry | QueueInTherapyEntry): string {
  return e.patient?.name ?? e.patientName;
}

export function queueEntryRecord(e: QueueWaitingEntry | QueueInTherapyEntry): string | null {
  return e.patient?.medicalRecordNumber ?? e.medicalRecordNumber;
}

export type PatientTurn = {
  serviceId: string;
  serviceKey: string;
  serviceName: string;
  color: string | null;
  turn: number;
  arrivedAt: string; // ISO
  waitMinutes: number;
  busyIn: string | null; // serviceId donde está en_terapia ahora, si aplica
};

// Un paciente puede esperar VARIAS terapias a la vez (spec §2.2): aparece una vez por cada una.
export function turnsByPatient(queue: FrontdeskQueue): Map<string, PatientTurn[]> {
  const map = new Map<string, PatientTurn[]>();
  for (const svc of queue.services) {
    for (const w of svc.waiting) {
      const list = map.get(w.patientId) ?? [];
      list.push({
        serviceId: svc.serviceId,
        serviceKey: svc.key,
        serviceName: svc.name,
        color: svc.color,
        turn: w.turn,
        arrivedAt: w.arrivedAt,
        waitMinutes: w.waitMinutes,
        busyIn: w.busyIn,
      });
      map.set(w.patientId, list);
    }
  }
  return map;
}

// La llegada más antigua del paciente entre sus terapias PENDIENTES (no "ocupado en X" — esa ya tiene
// su puesto reservado, pero no es la espera que debe empujarlo al frente de la lista general). Clave de
// orden nueva para sortPatients: reemplaza `presentAt` (que mezclaba consulta + cualquier servicio) por
// la espera real de terapia, por fuera, cuando el patient-desk pida la cola además de las sesiones.
export function earliestFreeWaitByPatient(queue: FrontdeskQueue): Map<string, string> {
  const map = new Map<string, string>();
  for (const svc of queue.services) {
    for (const w of svc.waiting) {
      if (w.busyIn) continue; // ocupado en otra terapia: no es espera libre
      const prev = map.get(w.patientId);
      if (!prev || w.arrivedAt < prev) map.set(w.patientId, w.arrivedAt);
    }
  }
  return map;
}

// Fase del paciente en la cola AHORA MISMO, para el orden de tres niveles del spec (§2.1.3): esperando
// libre → en terapia → (todo lo demás lo decide patient-day.ts, p. ej. terminado). "En terapia" gana
// sobre "esperando" aunque el paciente tenga otra terapia pendiente marcada `busyIn` — no está libre.
export function queuePhase(
  patientId: string,
  queue: FrontdeskQueue,
): "waiting" | "inTherapy" | null {
  let inTherapy = false;
  let waitingFree = false;
  for (const svc of queue.services) {
    if (svc.inTherapy.some((e) => e.patientId === patientId)) inTherapy = true;
    if (svc.waiting.some((e) => e.patientId === patientId && !e.busyIn)) waitingFree = true;
  }
  if (inTherapy) return "inTherapy";
  if (waitingFree) return "waiting";
  return null;
}
