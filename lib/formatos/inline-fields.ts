// "campos" layout: which header fields share the FIRST line (render.camposEnLinea, in that order) and
// which keep one line each below it. Data-driven per format — APEX asked for
// "Paciente · Record # · Sesión # · Fecha" on one line (owner, 04-nov-2026); formats without the key
// keep the legacy one-field-per-line header untouched.

export function splitInlineFields<T extends { clave: string }>(
  fields: T[],
  inlineKeys: readonly string[] | null | undefined,
): { inline: T[]; rest: T[] } {
  if (!inlineKeys?.length) return { inline: [], rest: fields };
  const inline = inlineKeys
    .map((k) => fields.find((f) => f.clave === k))
    .filter((f): f is T => !!f);
  return { inline, rest: fields.filter((f) => !inline.includes(f)) };
}
