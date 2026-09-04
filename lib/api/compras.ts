import { apiFetch } from "./client";

// Planificación de compras (la pantalla de gerencia). El BE calcula TODAS las columnas derivadas
// (promedio/total/meses/pedir/nuevoPedido/pedidoRedondeado) — el FE NO recalcula, solo pinta. Las
// columnas de CENTRO y de ORDEN salen de los arreglos `centers`/`posAbiertas` (se están abriendo centros
// nuevos → la tabla crece sola, nada escrito a mano). Permiso `compras.planificar` (gerencia).
// Handoff planificacion-compras-handoff-be-listo.
// NOTA: campos derivados NO en el mapa BE (llegan en español): existencias, poCantidades,
// ventasDelPeriodo, promedio, pedir, nuevoPedido, pedidoRedondeado, invTotal, enPo, posAbiertas,
// criterio1, criterio2.
export interface PlanCentro {
  clinicId: string;
  name: string;
}
export interface PlanPO {
  id: string;
  number: string | null;
  status?: string | null;
}
export interface PlanProducto {
  productId: string;
  sku?: string | null;
  name: string;
  existencias: Record<string, number>; // por clinicId
  poCantidades: Record<string, number>; // por poId
  ventasDelPeriodo: number;
  promedio: number;
  total: number;
  months: number;
  pedir: number; // 0 | 1 | 2
  nuevoPedido: number;
  pedidoRedondeado: number;
  invTotal: number;
  enPo: number;
}
export interface PlanificacionCompras {
  parameters: { months: number; criterio1: number; criterio2: number };
  centers: PlanCentro[];
  posAbiertas: PlanPO[];
  products: PlanProducto[];
}
export interface PlanParams {
  months?: number;
  criterio1?: number;
  criterio2?: number;
  from?: string; // YYYY-MM-DD (ancla la ventana de ventas)
}
export function getPlanificacionCompras(params: PlanParams = {}): Promise<PlanificacionCompras> {
  const sp = new URLSearchParams();
  if (params.months != null) sp.set("months", String(params.months));
  if (params.criterio1 != null) sp.set("criterio1", String(params.criterio1));
  if (params.criterio2 != null) sp.set("criterio2", String(params.criterio2));
  if (params.from) sp.set("from", params.from);
  const qs = sp.toString();
  return apiFetch<PlanificacionCompras>(`/inventory/purchase-orders/planning${qs ? `?${qs}` : ""}`);
}

// Editar la cantidad de un producto en una orden abierta. `quantity: 0` QUITA la línea (no deja un
// renglón en cero en el documento del proveedor). Se niega si la orden está recibida/cancelada.
export function actualizarItemOrden(
  poId: string,
  payload: { productId: string; quantity: number },
): Promise<unknown> {
  return apiFetch(`/inventory/purchase-orders/${poId}/items`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
// Renombrar el nº de la orden ante el proveedor.
export function actualizarNumeroOrden(poId: string, number: string): Promise<unknown> {
  return apiFetch(`/inventory/purchase-orders/${poId}/number`, {
    method: "PUT",
    body: JSON.stringify({ number }),
  });
}

// Crear una orden de compra. El BE EXIGE proveedor + almacén (a diferencia del legado, que solo pedía
// un número); por eso la pantalla los pide explícitos, sin asumir. `lines` = productos con su cantidad.
// «Ok P.O de pedido» manda la recomendación (pedidoRedondeado de los que hay que pedir). Handoff
// planificacion-compras-handoff-be-listo.
export interface CrearOrdenLinea {
  productId: string;
  quantity: number;
  unitCost?: number;
}
export function crearOrdenCompra(payload: {
  supplierId: string;
  warehouseId: string;
  lines: CrearOrdenLinea[];
  notes?: string;
}): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/inventory/purchase-orders`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Cancelar una orden abierta (borrador/enviada). Handoff planificacion-compras-handoff-be-listo.
export function cancelarOrden(poId: string): Promise<unknown> {
  return apiFetch(`/inventory/purchase-orders/${poId}/cancel`, { method: "POST" });
}
