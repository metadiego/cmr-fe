/**
 * Lo que la pantalla de viales necesita para DIBUJAR. El cálculo de verdad —remanente, porcentaje,
 * cuántos frascos cerrados quedan— lo hace el backend; aquí no se recalcula nada, solo se presenta.
 *
 * See docs/specs/pantalla-de-viales.md
 */

export interface VialActivo {
  porcentaje: number;
}

/** Relleno del frasco, 0–100. Sin vial activo no hay nada que llenar. */
export function nivelDelFrasco(activo: VialActivo | null | undefined): number {
  if (!activo) return 0;
  const p = Number(activo.porcentaje) || 0;
  // El BE ya lo acota, pero el dibujo no puede salirse del frasco pase lo que pase.
  return Math.min(100, Math.max(0, p));
}

const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

/**
 * «45 de 60 mg», tal como lo dice el legado y como lo lee el personal.
 *
 * Un remanente NEGATIVO se muestra con su signo: significa que se aplicó más de lo que el frasco tenía,
 * y esconderlo sería tapar justo la señal de que algo se registró mal.
 */
export function textoDeCapacidad(
  v: { remanente: number; capacidad: number },
  unidad?: string | null,
): string {
  const base = `${NUM.format(Number(v.remanente) || 0)} de ${NUM.format(
    Number(v.capacidad) || 0,
  )}`;
  return unidad ? `${base} ${unidad}` : base;
}

/** Lo mínimo que agruparPorDia necesita: cualquier consumo con fecha y cantidad sirve. */
export interface ConsumoDeVial {
  fecha: string;
  cantidad: number;
}

export interface DiaDeConsumos<T extends ConsumoDeVial = ConsumoDeVial> {
  dia: string;
  items: T[];
  total: number;
}

/**
 * Agrupa los consumos por DÍA, del más reciente al más viejo: así se lee una jornada de un vistazo, en
 * vez de una lista plana de cien filas. El total del día es lo aplicado ese día.
 */
export function agruparPorDia<T extends ConsumoDeVial>(
  consumos: T[],
): Array<DiaDeConsumos<T>> {
  const porDia = new Map<string, T[]>();
  for (const c of consumos ?? []) {
    const dia = String(c.fecha ?? "").slice(0, 10);
    if (!dia) continue;
    porDia.set(dia, [...(porDia.get(dia) ?? []), c]);
  }
  return [...porDia.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dia, items]) => ({
      dia,
      items,
      total: items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0),
    }));
}
