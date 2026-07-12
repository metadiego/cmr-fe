import type { components } from "./schema";
import { apiFetch } from "./client";

// Inventario — proveedores, productos y catálogos de apoyo.
export type Producto = components["schemas"]["ProductoEntity"];
export type Unidad = components["schemas"]["UnidadEntity"];
export type Clasificacion = components["schemas"]["ClasificacionEntity"];

export type Proveedor = components["schemas"]["ProveedorEntity"];
export type CreateProveedorPayload = components["schemas"]["CreateProveedorDto"];
export type UpdateProveedorPayload = components["schemas"]["UpdateProveedorDto"];

// Catálogos de apoyo (pueden venir vacíos si el BE aún no los sembró).
// `soloFisicos`: excluye servicios/consultas (usar en TODO picker de productos).
// Resiliente: si el BE aún no soporta `soloFisicos` (400), cae a lista completa y
// filtra servicios en el cliente — así funciona aunque el BE local vaya atrás.
export async function listProductos(
  opts: { soloFisicos?: boolean } = {},
): Promise<Producto[]> {
  if (opts.soloFisicos) {
    try {
      return await apiFetch<Producto[]>(
        `/inventario/productos?limit=100&soloFisicos=true`,
      );
    } catch {
      const all = await apiFetch<Producto[]>(`/inventario/productos?limit=100`);
      return all.filter((p) => p.tipo !== "servicio");
    }
  }
  return apiFetch<Producto[]>(`/inventario/productos?limit=100`);
}

// Proveedores (RBAC admin/super_admin). DELETE = baja lógica.
export function listProveedores(): Promise<Proveedor[]> {
  return apiFetch<Proveedor[]>(`/inventario/proveedores?limit=100`);
}
export function createProveedor(
  payload: CreateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventario/proveedores`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProveedor(
  id: string,
  payload: UpdateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventario/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/proveedores/${id}`, { method: "DELETE" });
}

export type CreateProductoPayload = components["schemas"]["CreateProductoDto"];
export type UpdateProductoPayload = components["schemas"]["UpdateProductoDto"];

export function createProducto(payload: CreateProductoPayload): Promise<Producto> {
  return apiFetch<Producto>(`/inventario/productos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProducto(
  id: string,
  payload: UpdateProductoPayload,
): Promise<Producto> {
  return apiFetch<Producto>(`/inventario/productos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProducto(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/productos/${id}`, { method: "DELETE" });
}

export function listUnidades(): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(`/inventario/unidades?limit=100`);
}

// Clasificaciones por tipo (marca | fabricante | categoria | …).
export function listClasificaciones(tipo?: string): Promise<Clasificacion[]> {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}&limit=100` : `?limit=100`;
  return apiFetch<Clasificacion[]>(`/inventario/clasificaciones${qs}`);
}

export type Almacen = components["schemas"]["AlmacenEntity"];
export type Ubicacion = components["schemas"]["UbicacionEntity"];

export function listAlmacenes(): Promise<Almacen[]> {
  return apiFetch<Almacen[]>(`/inventario/almacenes?limit=100`);
}
// Ubicaciones (opcional; puede filtrar por almacén). Devuelve [] si el BE no soporta el filtro.
export function listUbicaciones(almacenId?: string): Promise<Ubicacion[]> {
  const qs = almacenId ? `?almacenId=${almacenId}&limit=100` : `?limit=100`;
  return apiFetch<Ubicacion[]>(`/inventario/ubicaciones${qs}`).catch(() => []);
}

// AMP (presentación de proveedor) — dm+d: donde vive lo que cambia con el proveedor
// (concentración, contenido, factorABase). Catálogo GLOBAL. RBAC admin/super_admin.
export type PresentacionProveedor =
  components["schemas"]["PresentacionProveedorEntity"];
export type CreatePresentacionProveedorPayload =
  components["schemas"]["CreatePresentacionProveedorDto"];
export type UpdatePresentacionProveedorPayload =
  components["schemas"]["UpdatePresentacionProveedorDto"];

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
export function deletePresentacionProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/presentaciones-proveedor/${id}`, {
    method: "DELETE",
  });
}

// Recibir compra. CONTRATO CLAVE: con AMP, `cantidad` = EMPAQUES y `costoUnitario` =
// costo POR EMPAQUE; el BE convierte a unidad base con factorABase. NO pre-convertir.
// Sin AMP: cantidad/costo en unidad base directa.
export type RecibirCompraPayload = components["schemas"]["RecibirCompraDto"];
export function recibirCompra(payload: RecibirCompraPayload): Promise<unknown> {
  return apiFetch(`/inventario/operaciones/recibir-compra`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
