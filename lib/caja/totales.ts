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
 * Diferencia de caja EN VIVO, con la fórmula EXACTA de la CMA legacy (cuadre reporte.php,
 * `diferenciaReal = totalConteo − pettyCash − efectivoSistema`):
 *   diferencia = contado − inicio − ventasEfectivo
 * 0 = Perfect (cuadra); < 0 = Short (falta); > 0 = Over (sobra). `inicio` = fondo (petty) aplicado.
 * Es lógica de PRESENTACIÓN (contar en vivo); el cierre definitivo lo sella el BE.
 */
export function diferenciaCaja(
  contado: number,
  inicio: number,
  ventasEfectivo: number,
): number {
  return contado - inicio - ventasEfectivo;
}

/**
 * Orden de la grilla de conteo: por `valor` DESC (mayor→menor), la convención universal de arqueo
 * de caja (denominación mayor primero). Devuelve una copia (no muta el arreglo de entrada).
 */
export function ordenarDenominaciones<T extends DenominacionOrdenable>(
  denoms: ReadonlyArray<T>,
): T[] {
  return [...denoms].sort((a, b) => b.valor - a.valor);
}

/** Formato de moneda de la app (mismo estilo que el recibo térmico: `$0.00`). */
// Formateador ÚNICO del dinero de toda la caja (pantalla y hoja impresa): en-US con separador de miles
// y dos decimales ($28,138.37). El dueño lo pidió: quien firma el cuadre compara importes de un vistazo
// y sin los miles se leen mal. El BE devuelve números limpios a propósito; el formato es del FE.
const MONEY_FMT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function money(v: number): string {
  return MONEY_FMT.format(Number(v) || 0);
}
