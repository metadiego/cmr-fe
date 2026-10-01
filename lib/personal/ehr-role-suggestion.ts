// Type-only import — erased by --experimental-strip-types, same reasoning as lib/agenda/recurring-plan.ts:
// keeps this file free of any lib/api runtime import, so it stays testable without a network call.
import type { EhrRole } from "../api/ehr-integration.ts";

// Pure logic behind the pre-marked (never silently decided) role suggestion in the "Link with the
// EHR" dialog (components/personal/ehr-link-section.tsx). Handoff
// docs/specs/vincular-personal-con-el-ehr-handoff-fe.md: "comparar personal.cargo contra los `name`
// de la lista, sin acentos y en minúscula... a falta de un match exacto, no marcar nada".

// Cargo nuestro → nombre(s) del rol del EHR que calzarían. Cuando hay MÁS DE UNO (técnico puede ser
// Therapist o Staff), es a propósito ambiguo: sin un match único no se pre-marca nada.
export const JOB_TITLE_TO_EHR_ROLE_NAMES: Record<string, string[]> = {
  medico: ["Doctor"],
  enfermera: ["Nurse"],
  tecnico: ["Therapist", "Staff"],
};

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Sugerencia de UI local, recalculada cada vez contra la lista VIVA de roles — nunca guardada ni
// convertida en regla fija. Sin un match exacto y único, devuelve null: la persona elige.
export function suggestEhrRoleId(jobTitle: string | null | undefined, roles: EhrRole[]): string | null {
  if (!jobTitle) return null;
  const candidates = JOB_TITLE_TO_EHR_ROLE_NAMES[normalize(jobTitle)];
  if (!candidates || candidates.length !== 1) return null;
  const wanted = normalize(candidates[0]);
  return roles.find((r) => normalize(r.name) === wanted)?.id ?? null;
}
