/**
 * Ajuste de existencias: la cuenta que el personal NO tiene que hacer a mano.
 *
 * La gente cuenta lo que hay en la nevera, no la diferencia: «de los nano en sistema tengo 55 y en la
 * nevera 54». Pedirle el delta es pedirle una resta más, y una resta más es un error más. Estas
 * funciones traducen «lo que conté» al cuerpo que espera el BE (cantidad siempre positiva + signo).
 *
 * See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md
 */

export type SignoAjuste = "positivo" | "negativo";

export interface AjustePayload {
  productoId: string;
  almacenId: string;
  /** Siempre POSITIVA: el sentido lo da `signo`. */
  cantidad: number;
  signo: SignoAjuste;
  /** Clave del catálogo `motivos_movimiento` (el BE valida contra él). */
  motivo: string;
  notas: string;
}

/** Redondeo a 4 decimales: los viales se miden en fracciones y 0.3 - 0.1 no puede dar 0.199999… */
const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Diferencia entre lo que dice el sistema y lo que se contó. `null` cuando coinciden: un ajuste de cero
 * no es un ajuste, y mandarlo solo ensucia el historial.
 */
export function deltaDelConteo(
  stockActual: number,
  contado: number,
): { cantidad: number; signo: SignoAjuste } | null {
  const diff = r4(contado - stockActual);
  if (diff === 0) return null;
  return {
    cantidad: Math.abs(diff),
    signo: diff > 0 ? "positivo" : "negativo",
  };
}

/** El cuerpo del ajuste a partir de un conteo físico. `null` si no hay diferencia. */
export function ajusteDesdeConteo(opts: {
  productoId: string;
  almacenId: string;
  stockActual: number;
  contado: number;
  notas: string;
}): AjustePayload | null {
  const delta = deltaDelConteo(opts.stockActual, opts.contado);
  if (!delta) return null;
  return {
    productoId: opts.productoId,
    almacenId: opts.almacenId,
    cantidad: delta.cantidad,
    signo: delta.signo,
    // El conteo físico tiene su propio motivo en el catálogo: no es una «corrección» a ciegas.
    motivo: "conteo_fisico",
    notas: opts.notas,
  };
}
