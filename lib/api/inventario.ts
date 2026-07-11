import type { components } from "./schema";
import { apiFetch } from "./client";

// Inventario — dm+d: se receta/vende el DERIVADO, se compra/stockea el AMP
// (presentación del proveedor de turno). Ver docs/plans/handoff-fe-inventario-amp-2026-07-11.md.
export type Producto = components["schemas"]["ProductoEntity"];
export type Unidad = components["schemas"]["UnidadEntity"];
export type Clasificacion = components["schemas"]["ClasificacionEntity"];
export type PresentacionProveedor =
  components["schemas"]["PresentacionProveedorEntity"];
export type CreatePresentacionProveedorPayload =
  components["schemas"]["CreatePresentacionProveedorDto"];
export type UpdatePresentacionProveedorPayload =
  components["schemas"]["UpdatePresentacionProveedorDto"];

// Catálogos de apoyo (pueden venir vacíos si el BE aún no los sembró).
export function listProductos(): Promise<Producto[]> {
  return apiFetch<Producto[]>(`/inventario/productos?limit=100`);
}

export function listUnidades(): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(`/inventario/unidades?limit=100`);
}

// Clasificaciones por tipo (marca | fabricante | categoria | …).
export function listClasificaciones(tipo?: string): Promise<Clasificacion[]> {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}&limit=100` : `?limit=100`;
  return apiFetch<Clasificacion[]>(`/inventario/clasificaciones${qs}`);
}

// AMP (presentaciones de proveedor) de un producto. `activo` filtra bajas lógicas.
export function listPresentacionesProveedor(
  productoId: string,
  opts: { activo?: boolean } = {},
): Promise<PresentacionProveedor[]> {
  const sp = new URLSearchParams({ productoId });
  if (opts.activo !== undefined) sp.set("activo", String(opts.activo));
  return apiFetch<PresentacionProveedor[]>(
    `/inventario/presentaciones-proveedor?${sp.toString()}`,
  );
}

export function createPresentacionProveedor(
  payload: CreatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(`/inventario/presentaciones-proveedor`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePresentacionProveedor(
  id: string,
  payload: UpdatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(
    `/inventario/presentaciones-proveedor/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

// Baja lógica (activo=false), 204. Reactivar con update({activo:true}).
export function deletePresentacionProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/presentaciones-proveedor/${id}`, {
    method: "DELETE",
  });
}
