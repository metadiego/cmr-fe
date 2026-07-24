// Estructura ESTÁNDAR del botón de acciones por servicio (como el `reports_configuration` legacy):
// vive en `servicio.formAcciones` (jsonb). El motor del board la lee y pinta el botón para CUALQUIER
// servicio que la declare — NO se hardcodea un botón por servicio. El láser es solo una instancia.

export type EditableField = {
  name: string;
  label?: string;
  labelKey?: string;
  type?: "numero" | "texto" | string;
  default?: number | string;
};

// Un "report": un formato/acción con id despachable (p. ej. hilt, mls) y campos editables precargados.
export type ReportAccion = {
  id: string;
  name?: string;
  labelKey?: string;
  icon?: string;
  function?: string; // handler lógico (legacy: function|action)
  action?: string;
  editable_fields?: EditableField[];
};

// Acción adicional (modal/print) — p. ej. "Historial Completo".
export type AdditionalAccion = {
  id?: string;
  icon?: string;
  label?: string;
  labelKey?: string;
  type?: "modal" | "print" | string;
  target?: string;
};

export type AccionesConfig = {
  title?: string;
  titleKey?: string;
  reports?: ReportAccion[];
  additional_actions?: AdditionalAccion[];
};

// Lee la config de acciones del servicio de forma tolerante (formAcciones también guarda `campos`
// de medición; aquí solo nos interesan reports/additional_actions).
export function parseAcciones(formAcciones: unknown): AccionesConfig {
  const fa = (formAcciones ?? {}) as Record<string, unknown>;
  const reports = Array.isArray(fa.reports) ? (fa.reports as ReportAccion[]) : [];
  const additional = Array.isArray(fa.additional_actions) ? (fa.additional_actions as AdditionalAccion[]) : [];
  return {
    title: typeof fa.title === "string" ? fa.title : undefined,
    titleKey: typeof fa.titleKey === "string" ? fa.titleKey : undefined,
    reports,
    additional_actions: additional,
  };
}

// ¿El servicio tiene acciones que ameriten pintar el botón? (data-driven, sin hardcode por servicio).
export function serviceHasReports(formAcciones: unknown): boolean {
  const a = parseAcciones(formAcciones);
  return (a.reports?.length ?? 0) > 0 || (a.additional_actions?.length ?? 0) > 0;
}
