import { apiFetch } from "./client";

// Planificación de compras (la pantalla de gerencia). El BE calcula TODAS las columnas derivadas
// (promedio/total/meses/pedir/nuevoPedido/pedidoRedondeado) — el FE NO recalcula, solo pinta. Las
// columnas de CENTRO y de ORDEN salen de los arreglos `centros`/`posAbiertas` (se están abriendo centros
// nuevos → la tabla crece sola, nada escrito a mano). Permiso `compras.planificar` (gerencia).
// Handoff planificacion-compras-handoff-be-listo.
export interface PlanCentro {
  clinicId: string;
  nombre: string;
}
export interface PlanPO {
  id: string;
  numero: string | null;
  estado?: string | null;
}
export interface PlanProducto {
  productoId: string;
  sku?: string | null;
  nombre: string;
  existencias: Record<string, number>; // por clinicId
  poCantidades: Record<string, number>; // por poId
  ventasDelPeriodo: number;
  promedio: number;
  total: number;
  meses: number;
  pedir: number; // 0 | 1 | 2
  nuevoPedido: number;
  pedidoRedondeado: number;
  invTotal: number;
  enPo: number;
}
export interface PlanificacionCompras {
  parametros: { meses: number; criterio1: number; criterio2: number };
  centros: PlanCentro[];
  posAbiertas: PlanPO[];
  productos: PlanProducto[];
}
export interface PlanParams {
  meses?: number;
  criterio1?: number;
  criterio2?: number;
  desde?: string; // YYYY-MM-DD (ancla la ventana de ventas)
}
export function getPlanificacionCompras(params: PlanParams = {}): Promise<PlanificacionCompras> {
  const sp = new URLSearchParams();
  if (params.meses != null) sp.set("meses", String(params.meses));
  if (params.criterio1 != null) sp.set("criterio1", String(params.criterio1));
  if (params.criterio2 != null) sp.set("criterio2", String(params.criterio2));
  if (params.desde) sp.set("desde", params.desde);
  const qs = sp.toString();
  return apiFetch<PlanificacionCompras>(`/inventario/ordenes-compra/planificacion${qs ? `?${qs}` : ""}`);
}

// Editar la cantidad de un producto en una orden abierta. `cantidad: 0` QUITA la línea (no deja un
// renglón en cero en el documento del proveedor). Se niega si la orden está recibida/cancelada.
export function actualizarItemOrden(
  poId: string,
  payload: { productoId: string; cantidad: number },
): Promise<unknown> {
  return apiFetch(`/inventario/ordenes-compra/${poId}/items`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
// Renombrar el nº de la orden ante el proveedor.
export function actualizarNumeroOrden(poId: string, numero: string): Promise<unknown> {
  return apiFetch(`/inventario/ordenes-compra/${poId}/numero`, {
    method: "PUT",
    body: JSON.stringify({ numero }),
  });
}
