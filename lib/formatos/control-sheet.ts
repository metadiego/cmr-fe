// Legacy «control de sesiones» sheets (layout "tabla" + render.ocultarEmpresa: EMTT, Cámara Energética,
// Cámara Hiperbárica, PEMF, AVACEN, Bioresonancia, Transcraneal, APEX). Pure layout decisions, checked
// against the legacy PDFs in .personal/formatos-legacy.

/** Title «TERAPIA MAGNETRÓN (EMTT) · CONTROL de SESIONES» → big first line + smaller line below. */
export function splitControlTitle(title: string | null | undefined): { main: string; sub: string | null } {
  const t = (title ?? "").trim();
  const i = t.indexOf(" · ");
  if (i < 0) return { main: t, sub: null };
  return { main: t.slice(0, i).trim(), sub: t.slice(i + 3).trim() || null };
}

/**
 * How the header fields sit:
 * - two fields → one line, at opposite ends (AVACEN: «Paciente … Record #»);
 * - three or more → the bound fields one per line (Paciente / Record #), then the hand-filled ones
 *   (origen "") — a lone one on its own line with a long blank (EMTT «Área: ____»), several on one row
 *   (Cámara Energética «PEMF: ___  Cámara Energética: ___  Cámara Hiperbárica: ___»).
 */
export function controlHeaderLayout<T extends { origen?: string }>(
  fields: readonly T[],
): { spread: T[] | null; stacked: T[]; handRow: T[] } {
  if (fields.length <= 2) return { spread: [...fields], stacked: [], handRow: [] };
  const bound = fields.filter((f) => f.origen !== "");
  const hand = fields.filter((f) => f.origen === "");
  if (hand.length <= 1) return { spread: null, stacked: [...bound, ...hand], handRow: [] };
  return { spread: null, stacked: bound, handRow: hand };
}
