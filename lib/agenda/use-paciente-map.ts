"use client";

import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";

// Resolve a set of patient ids → Paciente in parallel, cached by the id set.
// Calendar rows (citas/sesiones) carry only pacienteId; this hydrates names.
export function usePacienteMap(ids: string[]): Record<string, Paciente> {
  const unique = Array.from(new Set(ids)).sort();
  const key = unique.join(",");
  const { state } = useResource<Record<string, Paciente>>(async () => {
    if (unique.length === 0) return {};
    const list = await Promise.all(
      unique.map((id) => getPaciente(id).catch(() => null)),
    );
    const map: Record<string, Paciente> = {};
    for (const p of list) if (p) map[p.id] = p;
    return map;
  }, [key]);
  return state.kind === "ok" ? state.data : {};
}
