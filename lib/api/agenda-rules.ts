import { apiFetch } from "./client";

// Qué bloquea al agendar vs. solo avisa (BE #547, handoff .personal/handoff-avisar-nunca-bloquear.md
// §5): por centro. Por defecto solo el feriado bloquea; todo lo demás (capacidad, cierre, paso de
// inicio, tope por paciente) se guarda igual y avisa (meta.advertencias). `[]` = nada bloquea, ni el
// feriado. GET exige preferences.read, PUT exige preferences.update.
export type BookingRuleKey = "capacity" | "closing" | "startStep" | "maxPerPatient" | "holiday";
export interface BookingRule {
  key: BookingRuleKey;
  labelKey: string;
  reasonKeys: string[];
  blocks: boolean;
}
export interface BookingRulesConfig {
  centerId: string;
  blockingRules: BookingRuleKey[];
  configured: boolean;
  showOffStepStarts: boolean;
  rules: BookingRule[];
}
export function getBookingRules(centerId: string): Promise<BookingRulesConfig> {
  return apiFetch<BookingRulesConfig>(`/agenda/rules/${centerId}`, {}, centerId);
}
export function setBookingRules(
  centerId: string,
  patch: { blockingRules: BookingRuleKey[]; showOffStepStarts?: boolean },
  centroId?: string,
): Promise<BookingRulesConfig> {
  return apiFetch<BookingRulesConfig>(
    `/agenda/rules/${centerId}`,
    { method: "PUT", body: JSON.stringify(patch) },
    centroId,
  );
}
