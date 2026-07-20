// Helpers PUROS del cuadre de caja (sin I/O, sin React) — testeables con `node --test`.
// El BE es la fuente de verdad del cierre (esperado/diferencia/snapshot); estos helpers cubren
// SOLO lo que la UI calcula en vivo mientras el cajero cuenta: total del conteo, la variación
// provisional que se muestra antes de cerrar, el orden de la grilla y el formato de moneda.
// See docs/specs/2026-07-20-cuadre-caja-design.md.

/** Una línea de conteo con su denominación asociada (valor unitario del catálogo del BE). */
export interface LineaConteo {
  valor: number;
  cantidad: number;
}

/** Denominación mínima para ordenar la grilla (dato del catálogo, nunca hardcode). */
export interface DenominacionOrdenable {
  orden: number;
  valor: number;
}

/** Total contado en vivo = Σ(valor × cantidad). Ignora cantidades no positivas/NaN (no restan). */
export function totalConteo(lineas: ReadonlyArray<LineaConteo>): number {
  return lineas.reduce((acc, l) => {
    const cant = Number.isFinite(l.cantidad) && l.cantidad > 0 ? l.cantidad : 0;
    const val = Number.isFinite(l.valor) ? l.valor : 0;
    return acc + val * cant;
  }, 0);
}

/**
 * Variación provisional que la UI muestra ANTES de cerrar (el cierre real lo sella el BE):
 * (efectivoContado − pettyDeclarado) − efectivoEsperado. >0 sobra, <0 falta.
 */
export function variacion(
  efectivoContado: number,
  pettyDeclarado: number,
  efectivoEsperado: number,
): number {
  return efectivoContado - pettyDeclarado - efectivoEsperado;
}

/**
 * Orden de la grilla de conteo: por `orden` ASC y, a igual orden, por `valor` DESC (mayor→menor),
 * igual que el catálogo del BE y la convención de arqueo (billete mayor a la izquierda).
 * Devuelve una copia (no muta el arreglo de entrada).
 */
export function ordenarDenominaciones<T extends DenominacionOrdenable>(
  denoms: ReadonlyArray<T>,
): T[] {
  return [...denoms].sort((a, b) => a.orden - b.orden || b.valor - a.valor);
}

/**
 * Efectivo esperado provisional (para el panel ANTES de cerrar) = Σ de `porMetodo[clave]` de las
 * formas marcadas `esEfectivo`. Refleja el mismo cálculo del BE (`CajaService.efectivoEsperado`),
 * usando SUS datos (flags `esEfectivo` + totales por método), no una regla inventada en el cliente.
 * El cierre real lo sigue sellando el BE.
 */
export function efectivoEsperado(
  porMetodo: Readonly<Record<string, number>>,
  clavesEfectivo: ReadonlyArray<string>,
): number {
  return clavesEfectivo.reduce((s, clave) => s + (porMetodo[clave] ?? 0), 0);
}

/** Formato de moneda de la app (mismo estilo que el recibo térmico: `$0.00`). */
export function money(v: number): string {
  return `$${(Number(v) || 0).toFixed(2)}`;
}
