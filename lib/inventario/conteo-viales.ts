/**
 * Contar en VIALES (envases cerrados por presentación) + lo que queda en los abiertos, en vez de pedir
 * el número en la medida base del producto. El 21-ago alguien escribió 12 y 13 viales donde iban
 * miligramos y Tirzepatide quedó en 13 mg con 26 viales en la nevera.
 *
 * El BE convierte y ajusta (POST /inventory/operations/count); aquí solo se arma el cuerpo y una vista
 * previa del total cuando el contenido del vial está en la misma medida que el stock.
 * See docs/specs/contar-en-viales-handoff-fe.md
 */

export interface PresentacionContable {
  id: string;
  name: string;
  content: number;
  contentUnitId: string | null;
}

export interface EnvaseContado {
  presentationId: string;
  quantity: number;
}

export interface ConteoPayload {
  productId: string;
  warehouseId: string;
  containers: EnvaseContado[];
  countedQuantity?: number;
}

const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Las presentaciones que se pueden contar por envase: activas y con contenido. */
export function presentacionesContables(
  ps: { id: string; name?: string | null; content?: number | string | null; contentUnitId?: string | null; active?: boolean | null }[],
): PresentacionContable[] {
  return ps
    .filter((p) => p.active !== false && Number(p.content) > 0)
    .map((p) => ({ id: p.id, name: p.name ?? "—", content: Number(p.content), contentUnitId: p.contentUnitId ?? null }));
}

const num = (s: string | undefined): number | null => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Total contado en la medida base, para enseñarlo ANTES de confirmar. `null` si algún vial contado
 * tiene su contenido en otra medida (eso lo convierte el BE) o si no se contó nada.
 */
export function totalEnBase(
  presentaciones: PresentacionContable[],
  cerrados: Record<string, string>,
  abiertos: string,
  unidadBaseId: string | null,
): number | null {
  let total = 0;
  let algo = false;
  for (const p of presentaciones) {
    const n = num(cerrados[p.id]);
    if (n == null || n === 0) continue;
    if (!unidadBaseId || p.contentUnitId !== unidadBaseId) return null;
    total += n * p.content;
    algo = true;
  }
  const a = num(abiertos);
  if (a != null) {
    total += a;
    algo = true;
  }
  return algo ? r4(total) : null;
}

/** El cuerpo de POST /inventory/operations/count, o `null` si no se contó nada. */
export function conteoPayload(opts: {
  productId: string;
  warehouseId: string;
  presentaciones: PresentacionContable[];
  cerrados: Record<string, string>;
  abiertos: string;
}): ConteoPayload | null {
  const containers = opts.presentaciones
    .map((p) => ({ presentationId: p.id, quantity: num(opts.cerrados[p.id]) ?? 0 }))
    .filter((c) => c.quantity > 0);
  const abiertos = num(opts.abiertos);
  if (containers.length === 0 && abiertos == null) return null;
  return {
    productId: opts.productId,
    warehouseId: opts.warehouseId,
    containers,
    ...(abiertos != null && { countedQuantity: abiertos }),
  };
}
