import type { components } from "./schema";
import { apiFetch } from "./client";

// Doctor working hours (per-doctor, or global when medicoId is null) and
// holidays — used to compute bookable slots and grey out unavailable days.
export type HorarioMedico = components["schemas"]["HorarioMedicoEntity"];
export type Festivo = components["schemas"]["FestivoEntity"];

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// GET /medicos/horarios?medicoId= — the doctor's hours, or the center's global
// hours (medicoId null) when the doctor has none. Empty = no hours configured.
export async function getHorariosMedico(
  medicoId?: string,
): Promise<HorarioMedico[]> {
  const q = medicoId ? `?medicoId=${encodeURIComponent(medicoId)}` : "";
  return asArray<HorarioMedico>(await apiFetch(`/medicos/horarios${q}`));
}

// GET /festivos?anio= — holidays for the year (recurring ones resolved to it).
export async function getFestivos(anio: number): Promise<Festivo[]> {
  return asArray<Festivo>(await apiFetch(`/festivos?anio=${anio}`));
}
