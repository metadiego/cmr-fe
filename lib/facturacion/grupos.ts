// Helpers PUROS de administración de grupos de facturación (sin I/O, sin React) — testeables con
// `node --test`. El BE no expone productosCount ni un filtro por grupo; el conteo y la partición de
// membresía se derivan del listado de productos (cada uno trae grupoFacturacionId).
// See docs/specs/fe-grupos-facturacion-admin-handoff.md.

export interface ProductoMin {
  id: string;
  grupoFacturacionId: string | null;
}

/** Nº de productos asignados a cada grupo (por grupoFacturacionId). */
export function contarPorGrupo(
  productos: ReadonlyArray<ProductoMin>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of productos) {
    if (p.grupoFacturacionId)
      out[p.grupoFacturacionId] = (out[p.grupoFacturacionId] ?? 0) + 1;
  }
  return out;
}

/**
 * Parte los productos en MIEMBROS del grupo (grupoFacturacionId === grupoId) y DISPONIBLES (el resto).
 * Base del transfer-list. Filtro `q` opcional (por un texto ya calculado por el llamador).
 */
export function particionarMembresia<T extends ProductoMin>(
  productos: ReadonlyArray<T>,
  grupoId: string,
): { miembros: T[]; disponibles: T[] } {
  const miembros: T[] = [];
  const disponibles: T[] = [];
  for (const p of productos) {
    if (p.grupoFacturacionId === grupoId) miembros.push(p);
    else disponibles.push(p);
  }
  return { miembros, disponibles };
}
