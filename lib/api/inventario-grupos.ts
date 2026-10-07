import type { Producto } from "./inventario";
import { apiFetchPaged } from "./client";

// Productos de un GRUPO de facturación (p. ej. Láser: HILT regular/full + MLS en 7 tamaños). Sin
// filtro server-side (el BE rechaza `billingGroupId` en la query), así que se pagina todo el
// catálogo y se filtra client-side — verificado en vivo que los productos de un grupo pueden caer
// en cualquier página, no solo la primera. Alimenta el picker de producto al fijar sesiones sin
// paquete en un servicio de grupo (handoff HANDOFF-sesiones-sin-paquete-listo.md).
export async function listProductosDeGrupo(
  billingGroupId: string,
  centroId?: string,
): Promise<Producto[]> {
  const out: Producto[] = [];
  const limit = 100;
  for (let page = 1; page <= 20; page++) {
    const { items, pagination } = await apiFetchPaged<Producto>(
      `/inventory/products?page=${page}&limit=${limit}`,
      {},
      centroId,
    );
    out.push(...items.filter((p) => p.billingGroupId === billingGroupId));
    if (page * limit >= pagination.total || items.length === 0) break;
  }
  return out;
}
