import { apiFetch } from "./client";

// A patient's therapy history per service (PR #148): feeds the «Historial de terapias» modal and the
// record's Therapies tab. Everything (X/Y, areas, staff) is projected by the BE; the FE only paints it.
// Old migrated rows → sesionNumero/staff null. Under v2 the service name travels in English
// (`serviceName`); `sesionNumero`/`areas`/`staffNombre` are not in the glossary and stay Spanish — that is
// the contract. Moved out of lib/api/frontdesk.ts, which had passed the 600-line ceiling.
export type HistorialSesion = {
  id: string;
  date: string;
  status: string;
  serviceId: string;
  serviceName: string | null;
  sesionNumero: number | null;
  totalSessions: number | null;
  areas: number | null;
  staffNombre: string | null;
  /** Came from the legacy system: its «n/m» is its own text, fixed with legacy-label (cmr-be #641). */
  migrated?: boolean;
};
export function getHistorialPaciente(
  pacienteId: string,
  servicioId?: string,
  centroId?: string,
): Promise<HistorialSesion[]> {
  const qs = servicioId ? `?serviceId=${encodeURIComponent(servicioId)}` : "";
  return apiFetch<unknown>(`/frontdesk/pacientes/${pacienteId}/historial${qs}`, {}, centroId).then((r) =>
    Array.isArray(r) ? (r as HistorialSesion[]) : (((r as { items?: HistorialSesion[] })?.items) ?? []),
  );
}
