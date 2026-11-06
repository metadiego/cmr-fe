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

// "campos" layout, `render.camposEnPares`: the legacy 2-column header table (one row per PAIR of
// consecutive fields, in the BE's own order) — e.g. APEX RF (owner, 06-nov-2026, replacing the
// one-line cramming asked for on 04-nov): Fecha|Paciente, Hora entrada|Hora salida, Sesión|Record.
// An odd field count leaves the last row with just one field (still a valid row, not dropped).
export function chunkPairs<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}
