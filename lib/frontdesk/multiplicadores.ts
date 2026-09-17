// Leyenda del desglose multiplicador, p.ej. "12 días × 1 área". Claves DINÁMICAS del grupo
// (nunca asumir cuáles ni cuántas); los labels salen de i18n (`mult.<clave>`, con fallback).
// Extraído de frontdesk-board.tsx para compartirlo (SesionesCell + diálogos) sin duplicar y bajar el techo.
export function legendMultiplicadores(
  mult: Record<string, number> | null | undefined,
  label: (clave: string) => string,
): string {
  if (!mult) return "";
  const partes = Object.entries(mult)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${Number(v)} ${label(k)}`);
  return partes.join(" × ");
}
