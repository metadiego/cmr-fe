import type { useFormatter, useTranslations } from "next-intl";

type RootT = ReturnType<typeof useTranslations>;

// Pinta el VALOR de una dimensión de un corte de analítica (BE cmr-be#546/#550): `labels[d] ?? group[d]`
// para la mayoría (ya vienen traducidas por el BE), más traducción propia para weekday (el BE manda el
// nombre en inglés, p. ej. "Monday") y kind ("appointment"/"therapy"), y formato de fecha para
// day/month/hour. `raw === null` = sin asignar (el dinero/evento no se pierde).
export function formatDimensionValue(
  dim: string,
  raw: string | null,
  label: string | null | undefined,
  format: ReturnType<typeof useFormatter>,
  t: RootT,
): string {
  if (raw == null) return t("reports.analytics.none");
  if (dim === "weekday") {
    const key = `reports.analytics.weekday.${raw.toLowerCase()}`;
    return t.has(key) ? t(key) : raw;
  }
  if (dim === "kind") {
    const key = `reports.analytics.kind.${raw}`;
    return t.has(key) ? t(key) : raw;
  }
  if (dim === "month") {
    const [y, m] = raw.split("-").map(Number);
    if (y && m) return format.dateTime(new Date(Date.UTC(y, m - 1, 1, 12)), "monthYear");
  }
  if (dim === "day") {
    const [y, m, d] = raw.split("-").map(Number);
    if (y && m && d) return format.dateTime(new Date(Date.UTC(y, m - 1, d, 12)), "dayMonthYear");
  }
  if (dim === "hour") return `${raw.padStart(2, "0")}:00`;
  return label ?? raw;
}

// La etiqueta de la COLUMNA del corte (p. ej. "Vendedor", "Mes"). Las claves vienen de
// reports.analytics.dim.<dimension> (messages/es.json y en.json); una dimensión nueva que no se haya
// agregado ahí cae al nombre crudo en vez de reventar.
export function dimensionLabel(dim: string, t: RootT): string {
  const key = `reports.analytics.dim.${dim}`;
  return t.has(key) ? t(key) : dim;
}
