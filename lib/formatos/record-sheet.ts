// The legacy «record» sheet (Sueroterapia Vit C, BPC-157, Plaquex — .personal/formatos-legacy/): a list
// of fields, one OBSERVACIONES box, the signatures. Which formats are drawn this way is read from the
// data, never from the slug.

type Sheet = {
  layout?: string;
  render?: object | null;
  sections?: ReadonlyArray<{ tipo: string; estilo?: string | null }>;
};

// Render options that mean another legacy template (pairs, inline fields, boxes, body image…).
const OTHER_TEMPLATE = ["camposEnPares", "camposEnLinea", "subrayarValores", "casillas", "imagenCuerpo", "imagenEscalaDolor"];

/** Layout «campos», none of the other templates' options, and exactly: the observations box + signatures. */
export function isRecordSheet(d: Sheet): boolean {
  if ((d.layout ?? "") !== "campos") return false;
  const r = (d.render ?? {}) as Record<string, unknown>;
  if (OTHER_TEMPLATE.some((k) => r[k] != null && r[k] !== false)) return false;
  const s = d.sections ?? [];
  return s.length === 2 && s[0].tipo === "texto_libre" && (s[0].estilo ?? "caja") === "caja" && s[1].tipo === "firmas";
}
