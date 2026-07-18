import type { useTranslations } from "next-intl";

type RootT = ReturnType<typeof useTranslations>;

// Etiqueta traducible de una forma de pago. El catálogo del BE guarda `nombre` en español; para i18n
// traducimos por `clave` (estable: efectivo/cheque/tarjeta/seguro/transferencia/master/visa) con
// `formasPago.<clave>`. Fallback al `nombre` para formas personalizadas/desconocidas (no se traducen).
// `t` debe ser el traductor RAÍZ (useTranslations() sin namespace) para resolver la clave completa.
export function formaPagoLabel(t: RootT, clave?: string | null, nombre?: string | null): string {
  const key = clave ? `formasPago.${clave}` : "";
  return key && t.has(key) ? t(key) : (nombre ?? "—");
}
