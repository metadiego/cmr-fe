// The GLP-1 body-composition sheet, drawn like the legacy (.personal/formatos-legacy/Glp-1.pdf). Pure
// helpers for its header line and its dose grid.

type Field = { clave: string; origen?: string };

/**
 * The legacy header: NOMBRE · RECORD · PESO on the first line, SESION # alone under it. Data-driven by
 * origin, not by key: fields bound to the session (`sesion.*`) go on the second line, the rest first.
 */
export function headerLines<T extends Field>(fields: readonly T[]): { first: T[]; second: T[] } {
  const isSession = (f: T) => (f.origen ?? "").startsWith("sesion.");
  return { first: fields.filter((f) => !isSession(f)), second: fields.filter(isSession) };
}

/** A measured value (the scale or the tape) is written over a line, like the legacy's PESO. */
export function isMeasured(f: Field): boolean {
  const o = f.origen ?? "";
  return o.startsWith("scale.") || o.startsWith("tape.");
}

/** A dose-grid cell that is a box to tick by hand (`{ segmentos: [{ opciones }] }`), not text. */
export function isTickBox(cell: unknown): boolean {
  const segs = (cell as { segmentos?: unknown } | null)?.segmentos;
  return Array.isArray(segs) && segs.some((s) => Array.isArray((s as { opciones?: unknown }).opciones));
}
