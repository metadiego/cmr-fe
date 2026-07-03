// Human-readable fallback for a missing i18n key. Takes the last dotted segment
// and turns snake/kebab into Title-ish case, e.g.
//   "citas.accion.volver_programada" → "Volver programada"
//   "op_titulo" → "Op titulo"
// Lets brand-new verticals (config-only) render readably without FE i18n edits.
export function humanizeKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  const s = last.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}
